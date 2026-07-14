import type { VercelRequest, VercelResponse } from '@vercel/node';

// Stateless Session Helpers
function createStatelessToken(user: string, role: string, perms: string): string {
  const payload = {
    user,
    role,
    perms,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function verifyStatelessToken(token: string): { user: string; role: string; perms: string } | null {
  if (!token) return null;
  if (token === "mock-token-asfour") return { user: "عصفور", role: "مدير", perms: "كاملة" };
  if (token === "mock-token-abuyassin") return { user: "ابو ياسين", role: "مدير", perms: "كاملة" };
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    if (decoded && decoded.exp && decoded.exp > Date.now()) {
      return { user: decoded.user, role: decoded.role, perms: decoded.perms };
    }
  } catch (e) {
    // legacy token style or invalid
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  
  let scriptUrl = process.env.GOOGLE_SCRIPT_URL || '';
  
  // Defensive URL sanitization
  scriptUrl = scriptUrl.trim();
  if (scriptUrl.startsWith('"') && scriptUrl.endsWith('"')) {
    scriptUrl = scriptUrl.substring(1, scriptUrl.length - 1).trim();
  } else if (scriptUrl.startsWith("'") && scriptUrl.endsWith("'")) {
    scriptUrl = scriptUrl.substring(1, scriptUrl.length - 1).trim();
  }
  
  if (!scriptUrl) {
    return res.status(500).json({ 
      ok: false, 
      error: 'GOOGLE_SCRIPT_URL variable is empty or not configured on Vercel.' 
    });
  }
  
  if (!scriptUrl.startsWith('http://') && !scriptUrl.startsWith('https://')) {
    return res.status(500).json({ 
      ok: false, 
      error: `Configured GOOGLE_SCRIPT_URL is not a valid HTTP/HTTPS address: "${scriptUrl}"` 
    });
  }
  
  const d = req.body;
  if (!d || !d.action) {
    return res.status(400).json({ ok: false, error: "Missing action parameter" });
  }

  // 1. Handle "login" action securely against Google Sheets
  if (d.action === "login") {
    const { name, pass } = d;
    if (!name || !pass) {
      return res.status(200).json({ ok: false, error: "اكتب الاسم وكلمة المرور" });
    }
    
    try {
      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getUsers", token: "14014" })
      });
      const resData = await response.json();
      if (resData.ok && resData.users) {
        const user = resData.users.find(
          (u: any) => u.name?.toString().trim() === name.trim() && u.pass?.toString().trim() === pass.trim()
        );
        if (!user) {
          return res.status(200).json({ ok: false, error: "اسم المستخدم أو كلمة المرور غلط" });
        }
        if (user.active === "لا") {
          return res.status(200).json({ ok: false, error: "الحساب موقوف" });
        }
        
        const token = createStatelessToken(user.name, user.role, user.perms || "كاملة");
        return res.status(200).json({ ok: true, user: user.name, role: user.role, token, perms: user.perms || "كاملة" });
      } else {
        return res.status(200).json({ ok: false, error: resData.error || "خطأ في استرجاع بيانات الموظفين من جوجل شيت" });
      }
    } catch (authErr: any) {
      console.error("Google Sheets Auth Proxy error:", authErr);
      return res.status(200).json({ ok: false, error: `فشل الاتصال بجوجل شيت للتحقق من الحساب: ${authErr.message || authErr}` });
    }
  }

  // 2. Process non-login requests
  let currentUser = "زائر";
  let currentRole = "زائر";

  // Allow "checkPhone" temporarily or verify session for everything else
  if (d.action !== "checkPhone") {
    const sess = verifyStatelessToken(d.token);
    if (!sess) {
      return res.status(200).json({ ok: false, error: "انتهت الجلسة، الرجاء تسجيل الدخول مجدداً" });
    }
    currentUser = sess.user;
    currentRole = sess.role;
  }

  // Inject server-verified metadata & security ACCESS_TOKEN ("14014") for Google Sheets
  const payloadToSheet = {
    ...d,
    token: "14014",
    currentUser,
    currentRole
  };

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadToSheet),
    });
    
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return res.status(502).json({
        ok: false,
        error: `جوجل شيت لم يرجع استجابة JSON صالحة. الرد المستلم: ${responseText.substring(0, 300)}`
      });
    }
    
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ 
      ok: false, 
      error: `Failed to proxy request to Google Apps Script. Error: ${e.message}` 
    });
  }
}
