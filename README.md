# Vunoh Global AI Assistant

An AI-powered web application built for the Vunoh Global AI Internship Practical Test. This application helps Kenyan diaspora customers seamlessly initiate and track three core services back home:
- Sending money
- Hiring local services (cleaners, errands, etc.)
- Verifying documents (land titles, IDs, certificates)

## Technology Stack
- **Backend:** Node.js with Express
- **Frontend:** HTML, CSS, and Vanilla JavaScript (No frameworks)
- **Database:** Supabase (PostgreSQL)
- **AI Brain:** Groq API (LLaMA-3.3-70B-Versatile)

## Architecture & Features
1. **User Input:** A clean, chat-based interface that allows users to type natural language requests.
2. **AI Intent Extraction:** Automatically triggers the Groq LLaMA model to identify intent (`send_money`, `hire_service`, `verify_document`, `check_status_update`) and extract entities (e.g., amount, location, document_type, recipient).
3. **Risk Scoring:** A contextual engine that calculates a risk score (0-100) based on diaspora-specific dimensions such as urgencies, transaction amounts, and sensitivity levels (e.g., land titles).
4. **Step Generation:** The AI produces a sequenced, actionable list of operational steps to fulfill the specific task.
5. **Multi-Format Messaging:** The AI generates three distinct confirmation formats automatically:
   - **WhatsApp:** Conversational, emoji-friendly, concise.
   - **Email:** Formal, comprehensive, displaying the full task code and detailed parameters.
   - **SMS:** Ultra-concise, under 160 characters.
6. **Employee Assignment:** Tasks are intelligently routed (Finance for money, Legal for documents, Operations for services).
7. **Task Dashboard:** A responsive, modern SPA dashboard that dynamically displays statuses, risks, teams, and enables inline status updates (Pending -> In Progress -> Completed).

## Setup & Running Locally

1. **Clone the repository and install dependencies:**
   ```bash
   cd vunoh-ai-assistant/backend
   npm install
   ```

2. **Environment Configuration:**
   Create a `.env` file inside the `backend` folder containing secrets:


3. **Database Schema:**
   The required SQL dump file is available in `/backend/db/schema.sql` (or root `schema.sql`). You can run this directly in the Supabase REST console or your Postgres client to set up the `tasks`, `task_steps`, `entities`, `messages`, and `status_history` tables.

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Access the application:**
   - App interface: `http://localhost:3000/app`
   - Authentication pages: `http://localhost:3000/login.html`

---

## Decisions I made and why

### Which AI tools you used and for which parts of the project
I leveraged Gemini and Groq (LLaMA 3.3) for this project. Gemini was used occasionally as an ideation and coding partner to help scaffold the Express.js architecture and write complex CSS for the modern layouts. Groq was integrated directly into the backend as the primary **AI Brain** because of its phenomenal inference speed, which is critical for maintaining an immediate, snappy chat-like feel when extracting intents and generating multi-format messages simultaneously.

### System Prompt Design
The system prompt for Intent and Entity extraction was designed to be highly structured. 
- **What I included:** I enforced strict JSON output with clear TypeScript-like schemas constraints. I firmly stated that the output intent *must* strictly be one of `[send_money, hire_service, verify_document, check_status]`. I explicitly requested it to extract an `urgency_level` parameter because this heavily influences my custom risk engine. 
- **What I excluded:** I avoided conversational prompt styles entirely. I explicitly declared "Do not include any conversational text or markdown blocks, return ONLY valid JSON", ensuring that the Express backend does not crash when parsing the response via `JSON.parse()`.

### One decision where you changed or overrode what the AI suggested
Initially, the AI suggested generating the task `steps`, WhatsApp `message`, SMS, and Email all within a single massive LLM prompt call to save code. However, I overrode this approach and separated the extraction, the step generation, and the messaging into isolated sequential/parallel functional services. 
**Reasoning:** Trying to make the LLM return an enormous JSON payload mimicking 5 different features simultaneously caused hallucinations, schema drift, and timeouts. By chaining the outputs (extracting intent first, then parallelizing step and message generations), the architecture became incredibly sturdy, maintainable, and much faster.

### One thing that did not work the way you expected and how you resolved it
I experienced intense, persistent timeouts (`UND_ERR_CONNECT_TIMEOUT`) when trying to connect my Node.js server to the Supabase REST API endpoint. After investigating, I discovered that starting in Node v18+, the internal `undici` fetch client prioritizes IPv6 DNS resolution by default. Because the local environment and Cloudflare (which hosts Supabase APIs) had mismatched IPv6 tunnel routing, the fetches would hang up completely. 
**Resolution:** Instead of downgrading Node or using Axios, I forced the Node DNS resolver to prioritize IPv4 globally by inserting `require('node:dns').setDefaultResultOrder('ipv4first');` within the Supabase connection client setup. This completely eliminated the timeout issues overhead.

### Risk Scoring Logic
The custom risk engine is tailored to the Kenyan diaspora and evaluated systematically from 0-100:
- **Base Risk:** All intents have a base (e.g. Services = 0, Sending Money = 20, Documents = 40). Land title documents in particular suffer from high fraud in Kenya, triggering a severe baseline.
- **Urgency Multiplier:** If the user specifies "urgently" or "ASAP", the risk jumps by +15 points. Scammers typically create false urgency to skip verification rules.
- **Amount Thresholds:** For `send_money`, amounts over 50,000 KES increment the risk score heavily (+25), flagging it for deeper manual verification by the Finance team. 
- **Recipient Flags:** The lack of a specific, known recipient detail in the prompt directly contributes an additional +10 risk points due to AML/KYC blindspots.
