import os
import re
from datetime import datetime, date
from typing import List, Dict, Any, Optional
import httpx
from backend.models import Contact, Interaction

class AIService:
    async def generate_chat_response(
        self, 
        message: str, 
        contacts: List[Contact], 
        session_id: str
    ) -> str:
        """
        Processes a chat message. Checks if a live LLM key is available, 
        otherwise falls back to our local intelligent graph/NLP reasoning engine.
        """
        # Try to resolve API keys
        openai_key = os.getenv("OPENAI_API_KEY")
        gemini_key = os.getenv("GEMINI_API_KEY")
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        deepseek_key = os.getenv("DEEPSEEK_API_KEY")

        if deepseek_key:
            return await self._call_deepseek(message, contacts, deepseek_key)
        elif openai_key:
            return await self._call_openai(message, contacts, openai_key)
        elif gemini_key:
            return await self._call_gemini(message, contacts, gemini_key)
        elif anthropic_key:
            return await self._call_anthropic(message, contacts, anthropic_key)
        else:
            # Smart Offline NLP & Graph Engine
            return self._local_reasoning_engine(message, contacts)

    def _local_reasoning_engine(self, message: str, contacts: List[Contact]) -> str:
        msg_lower = message.lower().strip()
        
        # 1. TEMPORAL QUERY: "90 days", "not spoken", "neglected", "quiet"
        if any(x in msg_lower for x in ["90 days", "30 days", "not spoken", "neglected", "timeline", "quiet", "follow up"]):
            limit_days = 90
            if "30 days" in msg_lower:
                limit_days = 30
            
            neglected = []
            today = date.today()
            for c in contacts:
                if c.archived:
                    continue
                last_date = None
                if c.interactions:
                    # interactions are ordered desc by date
                    last_date = c.interactions[0].date
                
                if not last_date:
                    neglected.append((c, "never"))
                else:
                    days_since = (today - last_date).days
                    if days_since >= limit_days:
                        neglected.append((c, f"{days_since} days ago"))
            
            if not neglected:
                return f"Fantastic! You've stayed in touch with everyone in your database in the last {limit_days} days. Your network is active and healthy!"
            
            resp = f"Here are the contacts in your network you haven't spoken to in over **{limit_days} days**:\n\n"
            for c, time_ago in neglected:
                company_str = f" at {c.current_company}" if c.current_company else ""
                role_str = f" ({c.current_role})" if c.current_role else ""
                resp += f"• **{c.name}**{role_str}{company_str} — Last contact: *{time_ago}*\n"
            resp += "\n*Insight: Reaching out to one of these today would be an excellent way to maintain your network velocity.*"
            return resp

        # 2. SIMILARITY QUERY: "what do X and Y have in common", "common"
        # Look for names of contacts in the prompt
        found_contacts = []
        for c in contacts:
            if c.name.lower() in msg_lower:
                found_contacts.append(c)
        
        # If the user mentioned two specific contacts
        if len(found_contacts) >= 2 or ("common" in msg_lower and len(found_contacts) == 1):
            c1 = found_contacts[0]
            c2 = found_contacts[1] if len(found_contacts) > 1 else (contacts[1] if len(contacts) > 1 else None)
            
            if not c2:
                return f"I see you asked about commonalities but I could only identify {c1.name} in your network. Add another contact to test this!"

            shared_companies = []
            shared_tags = []
            shared_interests = []

            # Compare company/roles
            if c1.current_company and c1.current_company == c2.current_company:
                shared_companies.append(c1.current_company)
            
            # Compare tags
            t1 = set(c1.tags or [])
            t2 = set(c2.tags or [])
            shared_tags = list(t1.intersection(t2))

            # Compare interests
            i1 = set(c1.interests or [])
            i2 = set(c2.interests or [])
            shared_interests = list(i1.intersection(i2))

            resp = f"### Commonalities: **{c1.name}** & **{c2.name}**\n\n"
            
            if shared_companies:
                resp += f"• 🏢 **Professional Context**: Both work/associated with **{', '.join(shared_companies)}**.\n"
            else:
                resp += f"• 🏢 **Professional Context**: {c1.name} is at *{c1.current_company or 'Unknown'}* and {c2.name} is at *{c2.current_company or 'Unknown'}*.\n"
            
            if shared_tags:
                resp += f"• 🏷️ **Tags**: They share categories: {', '.join([f'`{t}`' for t in shared_tags])}.\n"
            
            if shared_interests:
                resp += f"• 🎨 **Personal Interests**: Both enjoy: *{', '.join(shared_interests)}*.\n"
            
            if not (shared_companies or shared_tags or shared_interests):
                resp += f"They don't share any direct structural records (tags, interests, or companies) in your notes yet. However, {c1.name} is an expert in *{c1.current_role or 'general'}* and {c2.name} focuses on *{c2.current_role or 'general'}*."
                
            return resp

        # 3. PATH/GRAPH QUERY: "how do I connect", "path", "introduce", "connection", "sequoia", "palantir", "goldman"
        # Find paths to a specific target or company
        path_target = None
        for company in ["palantir", "sequoia", "goldman", "goldman sachs", "citadel", "google", "meta", "founders fund"]:
            if company in msg_lower:
                path_target = company
                break
        
        if "path" in msg_lower or "connect" in msg_lower or path_target:
            # Search for people associated with the path target
            target_contacts = []
            for c in contacts:
                text_to_search = f"{c.current_company or ''} {c.current_role or ''} {c.notes or ''}".lower()
                # Check experience history
                for exp in (c.experience or []):
                    text_to_search += f" {exp.get('company', '')} {exp.get('role', '')}".lower()
                
                if path_target and path_target in text_to_search:
                    target_contacts.append(c)
                elif not path_target:
                    # User might be asking for a path to a specific person's name
                    for match_name in msg_lower.split():
                        if len(match_name) > 3 and match_name in c.name.lower():
                            target_contacts.append(c)

            if target_contacts:
                tc = target_contacts[0]
                resp = f"### Path Analysis to **{tc.name}** ({tc.current_company or 'Independent'})\n\n"
                
                # Check introductions / relations
                path_found = False
                # If someone introduced this person
                if tc.introduced_by:
                    introducer = next((x for x in contacts if x.id == tc.introduced_by), None)
                    if introducer:
                        resp += f"1. You met **{tc.name}** through **{introducer.name}**.\n"
                        resp += f"2. Reach out to **{introducer.name}** for a re-introduction or warm touchpoint!\n"
                        path_found = True
                
                # Check who knows this person (related_to)
                knows_them = []
                for c in contacts:
                    if tc.id in [r.id for r in c.related_to]:
                        knows_them.append(c)
                
                if knows_them:
                    resp += f"• **Shared node**: **{', '.join([x.name for x in knows_them])}** in your network also know {tc.name}.\n"
                    path_found = True

                if not path_found:
                    resp += f"You have a direct relationship logged with **{tc.name}**.\n"
                    if tc.approach_notes:
                        resp += f"• **Approach Strategy**: {tc.approach_notes}\n"
                    else:
                        resp += f"• *Tip: Set up a coffee catchup. They are located in the `{tc.how_we_met or 'general'}` sector of your database.*\n"
                return resp
            
            if path_target:
                return f"I couldn't find anyone directly connected to **{path_target}** in your network. Try adding a contact with experience there or tag them to map a path!"

        # 4. COMPANY/SKILLS SEARCH: "who is at", "who works", "skills", "experience", "trading", "goldman"
        # Find matches by company or skills
        company_query = None
        for c in contacts:
            if c.current_company and c.current_company.lower() in msg_lower:
                company_query = c.current_company
                break
        
        # Scan for explicit skills
        skill_queries = ["trading", "logistics", "commodity", "investor", "vc", "founder", "software", "product", "sales", "ai", "finance"]
        active_skills = [s for s in skill_queries if s in msg_lower]

        if company_query:
            matches = [c for c in contacts if c.current_company and c.current_company.lower() == company_query.lower()]
            resp = f"### Contacts at **{company_query}**:\n\n"
            for m in matches:
                resp += f"• **{m.name}** — {m.current_role}\n"
                if m.email:
                    resp += f"  - Email: `{m.email}`\n"
                if m.notes:
                    resp += f"  - Note: *\"{m.notes[:100]}...\"*\n"
            return resp

        if active_skills:
            skill = active_skills[0]
            matches = []
            for c in contacts:
                search_block = f"{c.current_role or ''} {c.notes or ''} {' '.join(c.tags or [])} {' '.join(c.interests or [])}".lower()
                for exp in (c.experience or []):
                    search_block += f" {exp.get('role', '')} {exp.get('company', '')}".lower()
                if skill in search_block:
                    matches.append(c)
            
            if matches:
                resp = f"### Network search for **\"{skill}\"**:\n\n"
                for m in matches:
                    company_str = f" at {m.current_company}" if m.current_company else ""
                    resp += f"• **{m.name}** — {m.current_role or 'Specialist'}{company_str}\n"
                    if m.tags:
                        resp += f"  - Tags: {', '.join([f'`{t}`' for t in m.tags])}\n"
                return resp
            else:
                return f"I searched your network for **\"{skill}\"** but didn't find any direct matches. Try adding tags or experience entries for this skill."

        # 5. CONTACT LOOKUP: "what do I know about X"
        for c in contacts:
            if c.name.lower() in msg_lower:
                resp = f"### Profile Summary: **{c.name}**\n\n"
                resp += f"💼 **Current**: {c.current_role or 'N/A'} at **{c.current_company or 'Independent'}**\n"
                resp += f"🤝 **How you met**: {c.how_we_met or 'Not specified'}\n"
                if c.tags:
                    resp += f"🏷️ **Tags**: {', '.join([f'`{t}`' for t in c.tags])}\n"
                if c.interests:
                    resp += f"🎨 **Interests**: {', '.join(c.interests)}\n"
                if c.approach_notes:
                    resp += f"🎯 **Approach Strategy**: {c.approach_notes}\n"
                if c.notes:
                    resp += f"📝 **Notes**: {c.notes}\n"
                
                # Last interaction
                if c.interactions:
                    resp += f"📅 **Last Interaction**: {c.interactions[0].date} — *\"{c.interactions[0].note}\"*\n"
                else:
                    resp += "📅 **Last Interaction**: Never logged\n"
                return resp

        # GENERAL CONVERSATIONAL FALLBACK
        # If no specific rules match, provide a highly personalized, context-aware greeting
        resp = "Hi! I am your **NetGraph Relationship Intelligence Agent**.\n\n"
        resp += f"I have processed your **{len(contacts)} contacts** and mapped their relationships. Here are a few things you can ask me:\n\n"
        resp += "1. 📅 *\"Who have I not spoken to in 90 days?\"*\n"
        if len(contacts) > 1:
            resp += f"2. 🤝 *\"What do {contacts[0].name} and {contacts[1].name if len(contacts)>1 else 'Sarah'} have in common?\"*\n"
        resp += "3. 🏢 *\"Who do I know at Goldman Sachs?\"* (or other corporate environments)\n"
        resp += "4. 🧭 *\"Give me my connection path to Palantir.\"*\n"
        resp += "5. 🎯 *\"How should I approach Michael?\"*\n\n"
        resp += "*Note: Zep local service is running in standby fallback mode. Ready for full semantic operations.*"
        return resp

    async def _call_openai(self, message: str, contacts: List[Contact], api_key: str) -> str:
        # Full OpenAI implementation with structured prompt context
        context = self._build_context(contacts)
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": f"You are a relationship intelligence assistant. You have full access to the user's CRM database.\n\nCRM DATABASE:\n{context}"},
                            {"role": "user", "content": message}
                        ],
                        "temperature": 0.3
                    },
                    timeout=30.0
                )
                if response.status_code == 200:
                    return response.json()["choices"][0]["message"]["content"]
                else:
                    return f"OpenAI API Error (Status {response.status_code}): {response.text}"
        except Exception as e:
            return f"Failed to call OpenAI: {e}"

    async def _call_deepseek(self, message: str, contacts: List[Contact], api_key: str) -> str:
        context = self._build_context(contacts)
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.deepseek.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": "deepseek-chat",
                        "messages": [
                            {"role": "system", "content": f"You are a relationship intelligence assistant. You have full access to the user's CRM database.\n\nCRM DATABASE:\n{context}"},
                            {"role": "user", "content": message}
                        ],
                        "temperature": 0.2
                    },
                    timeout=30.0
                )
                if response.status_code == 200:
                    return response.json()["choices"][0]["message"]["content"]
                else:
                    return f"DeepSeek API Error (Status {response.status_code}): {response.text}"
        except Exception as e:
            return f"Failed to call DeepSeek: {e}"

    async def _call_gemini(self, message: str, contacts: List[Contact], api_key: str) -> str:
        context = self._build_context(contacts)
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
                    json={
                        "contents": [{
                            "parts": [{"text": f"You are NetGraph's relationship intelligence assistant. You have full access to the user's private contact database.\n\nCONTACT DATABASE:\n{context}\n\nUser Question: {message}"}]
                        }]
                    },
                    timeout=30.0
                )
                if response.status_code == 200:
                    return response.json()["candidates"][0]["content"]["parts"][0]["text"]
                else:
                    return f"Gemini API Error (Status {response.status_code}): {response.text}"
        except Exception as e:
            return f"Failed to call Gemini: {e}"

    async def _call_anthropic(self, message: str, contacts: List[Contact], api_key: str) -> str:
        context = self._build_context(contacts)
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": "claude-3-5-sonnet-20241022",
                        "max_tokens": 1000,
                        "system": f"You are NetGraph's relationship intelligence assistant. You have full access to the user's private contact database.\n\nCONTACT DATABASE:\n{context}",
                        "messages": [{"role": "user", "content": message}],
                        "temperature": 0.2
                    },
                    timeout=30.0
                )
                if response.status_code == 200:
                    return response.json()["content"][0]["text"]
                else:
                    return f"Anthropic API Error (Status {response.status_code}): {response.text}"
        except Exception as e:
            return f"Failed to call Anthropic: {e}"

    def _build_context(self, contacts: List[Contact]) -> str:
        parts = []
        for c in contacts:
            exps = []
            for e in (c.experience or []):
                exps.append(f"{e.get('role')} at {e.get('company')}")
            exp_str = ", ".join(exps)
            
            last_i = "never"
            if c.interactions:
                last_i = f"{c.interactions[0].date} ({c.interactions[0].note})"

            parts.append(f"""
            ID: {c.id}
            NAME: {c.name}
            TYPE: {c.type}
            COMPANY: {c.current_company}
            ROLE: {c.current_role}
            EXPERIENCE: {exp_str}
            INTERESTS: {', '.join(c.interests or [])}
            TAGS: {', '.join(c.tags or [])}
            HOW MET: {c.how_we_met}
            APPROACH NOTES: {c.approach_notes}
            PHILOSOPHY: {c.philosophy}
            NOTES: {c.notes}
            LAST INTERACTION: {last_i}
            ---""")
        return "\n".join(parts)

ai_service = AIService()
