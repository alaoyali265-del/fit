import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({limit:"12mb"}));
app.use(express.static(path.join(__dirname,"public")));

app.post("/api/ai", async (req,res) => {
  try {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return res.status(503).json({error:"الذكاء الاصطناعي غير مربوط بعد. أضف OPENROUTER_API_KEY إلى ملف .env على الخادم."});
    const {task,text,image,mime,context} = req.body || {};
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
    let system = "أنت مساعد تغذية ولياقة عربي عراقي. كن دقيقاً ومتحفظاً ولا تدّع دقة غير ممكنة. تقديرات الطعام تقريبية. لا تشخّص أمراضاً ولا تعطِ نصائح قاسية لتقييد الطعام. إذا كان العمر أقل من 18 فلا توصي بعجز سعرات أو تنشيف دون إشراف مختص.";
    let content;
    if (task === "food_text" || task === "food_image") {
      system += " حلل الوجبة وقدر حصصاً معتادة دون طلب الوزن من المستخدم. أخرج JSON صالحاً فقط بهذا الشكل: {\"items\":[{\"name\":\"اسم الصنف\",\"grams\":150,\"kcal\":250,\"protein\":15,\"carbs\":30,\"fat\":8}],\"total\":{\"kcal\":250}}. كل عنصر منفصل. لا تضف markdown.";
      const prompt = task === "food_image"
        ? "حلل صورة الوجبة. استنتج الأطعمة الظاهرة وقدر الوزن بالغرام لكل صنف. لا تخترع مكونات لا تظهر. أعد JSON فقط."
        : `حلل الوجبة التالية وقدر مكوناتها وحصصها المعتادة بالغرام: ${String(text||"")}`;
      content = task === "food_image" ? [{type:"text",text:prompt},{type:"image_url",image_url:{url:image}}] : prompt;
    } else {
      system += ` بيانات اليوم: ${JSON.stringify(context||{})}. أجب باختصار وبشكل عملي.`;
      content = String(text||"");
    }
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:"POST",
      headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json","X-OpenRouter-Title":"Urfit Plus"},
      body:JSON.stringify({model,messages:[{role:"system",content:system},{role:"user",content}]})
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({error:data?.error?.message || "فشل طلب الذكاء الاصطناعي"});
    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) return res.status(502).json({error:"وصل رد فارغ من النموذج"});
    res.json({text: typeof answer === "string" ? answer : JSON.stringify(answer)});
  } catch (e) {
    res.status(500).json({error:"حدث خطأ بالخادم: "+e.message});
  }
});
const port = process.env.PORT || 3000;
app.listen(port,"0.0.0.0",()=>console.log(`Urfit Plus running on http://localhost:${port}`));
