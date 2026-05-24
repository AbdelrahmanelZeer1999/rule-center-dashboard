# Rule Center — Test Results Dashboard

موقع كامل لعرض نتايج الـ REST Assured tests، فيه:

- **Backend**: Spring Boot 3 + SQLite — يستقبل النتايج من REST Assured عبر POST endpoint
- **Frontend**: Vite + React — dashboard فيه stats و charts و test cases list
- **Storage**: SQLite file على الديسك (`rulecenter.db`)

---

## المتطلبات

قبل ما تشغّل، لازم يكون عندك:

1. **Java 17+** — تأكد بـ `java -version`
2. **Maven 3.6+** — تأكد بـ `mvn -version`
3. **Node.js 18+** و **npm** — تأكد بـ `node -v` و `npm -v`

---

## تشغيل الـ Backend

افتح terminal وروح لـ folder الـ backend:

```bash
cd backend
mvn spring-boot:run
```

الـ server هيشتغل على `http://localhost:8080`.

أول مرة هيـ download dependencies (ياخد دقيقتين)، وبعد كده هيبقى سريع.

لو الـ Maven مش متظبط في الـ PATH، تقدر تستخدم IntelliJ مباشرة:

1. افتح فولدر `backend` في IntelliJ
2. IntelliJ هيكتشف الـ `pom.xml` ويـ import المشروع
3. افتح ملف `RuleCenterApplication.java` ودوس على زرار الـ ▶ run

**الـ endpoints المتاحة:**

| Method | Path | الوصف |
|--------|------|--------|
| `GET` | `/api/runs` | كل الـ runs (الأحدث الأول) |
| `GET` | `/api/runs/{id}` | run معين |
| `POST` | `/api/runs` | submit run جديد ← ده اللي REST Assured يستخدمه |
| `DELETE` | `/api/runs/{id}` | يمسح run واحد |
| `DELETE` | `/api/runs` | يمسح كل الـ runs |
| `GET` | `/api/runs/stats` | aggregate stats |

**اختبار سريع:**

في terminal جديد، جرّب:

```bash
curl http://localhost:8080/api/runs
```

المفروض ترجعلك `[]` (array فاضي).

---

## تشغيل الـ Frontend

في terminal تاني، روح لـ folder الـ frontend:

```bash
cd frontend
npm install
npm run dev
```

الموقع هيفتح تلقائي على `http://localhost:5173`.

أول مرة `npm install` هياخد دقيقتين، بعد كده الـ `npm run dev` بيشتغل في ثواني.

---

## إزاي تربط REST Assured بالـ Backend

في الـ test suite بتاعتك، ضيف method بـ `@AfterSuite` تبعت النتايج للـ backend:

```java
import io.restassured.RestAssured;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.testng.annotations.AfterSuite;

public class TestResultPublisher {

    // مكان ما بتجمّع نتايج الـ tests خلال الـ run
    private static final List<Map<String, Object>> collectedResults = new ArrayList<>();

    public static void recordResult(String name, String endpoint, String status,
                                     int duration, int statusCode, String errorMessage) {
        Map<String, Object> r = new HashMap<>();
        r.put("name", name);
        r.put("endpoint", endpoint);
        r.put("status", status);
        r.put("duration", duration);
        r.put("statusCode", statusCode);
        r.put("errorMessage", errorMessage);
        collectedResults.add(r);
    }

    @AfterSuite
    public void publishResults() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("runId", "run_" + System.currentTimeMillis());
        payload.put("timestamp", Instant.now().toString());
        payload.put("suite", "RuleEvaluationTests");
        payload.put("environment", "staging");
        payload.put("tests", collectedResults);

        String json = new ObjectMapper().writeValueAsString(payload);

        RestAssured.given()
            .contentType("application/json")
            .body(json)
            .post("http://localhost:8080/api/runs");
    }
}
```

---

## الـ Project Structure

```
rule-center/
├── backend/                     ← Spring Boot
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/rulecenter/
│       │   ├── RuleCenterApplication.java
│       │   ├── model/           ← TestRun, TestResult entities
│       │   ├── repository/      ← JPA repository
│       │   ├── controller/      ← REST endpoints
│       │   └── config/          ← CORS config
│       └── resources/
│           └── application.properties
└── frontend/                    ← Vite + React
    ├── package.json
    ├── index.html
    └── src/
        ├── main.jsx
        ├── index.css
        └── App.jsx              ← الـ dashboard كله هنا
```

---

## الـ JSON Schema المتوقع

ده الـ format اللي الـ `POST /api/runs` بيستقبله:

```json
{
  "runId": "run_2026_05_24_001",
  "timestamp": "2026-05-24T14:32:11Z",
  "suite": "RuleEvaluationTests",
  "environment": "staging",
  "tests": [
    {
      "name": "shouldCreateNewRule",
      "endpoint": "POST /api/rules",
      "status": "PASS",
      "duration": 142,
      "statusCode": 201,
      "errorMessage": null
    }
  ]
}
```

**ملاحظات:**

- `runId` لو ما اتبعتش، الـ backend هيولّد واحد تلقائي
- `timestamp` لو ما اتبعتش، الـ backend هيحط الـ current time
- `status` لازم يكون واحد من: `PASS`, `FAIL`, `SKIP`
- `errorMessage` optional — يتساب `null` لو الـ test pass

---

## Troubleshooting

**المشكلة: الـ Frontend يقول OFFLINE**

- اتأكد إن الـ backend شغّال على port 8080
- جرّب `curl http://localhost:8080/api/runs` يرجّع response

**المشكلة: CORS error في الـ browser console**

- تأكد إن الـ frontend شغال على `http://localhost:5173`
- لو على port تاني، عدّل `backend/src/main/java/com/rulecenter/config/WebConfig.java` وضيف الـ origin

**المشكلة: SQLite errors عند الـ startup**

- امسح ملف `rulecenter.db` من فولدر `backend` وأعد التشغيل
- أحياناً بيحصل لو غيّرت الـ entities وعندك data قديمة

**المشكلة: Port 8080 شغال أصلاً**

- غيّر الـ port في `backend/src/main/resources/application.properties`:
  ```
  server.port=8081
  ```
- وعدّل `frontend/src/App.jsx` تغير `API_BASE`، أو شغّل الـ frontend بـ:
  ```
  VITE_API_BASE=http://localhost:8081 npm run dev
  ```
