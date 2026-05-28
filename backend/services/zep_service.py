import os
import logging
import httpx
from typing import List, Dict, Any, Optional

logger = logging.getLogger("netgraph.zep")

ZEP_API_URL = os.getenv("ZEP_API_URL", "http://localhost:8000")

class ZepService:
    def __init__(self):
        self.client_url = ZEP_API_URL
        self.is_connected = False
        self._check_connection()

    def _check_connection(self):
        try:
            # Quick health check to see if local Zep Docker container is up
            response = httpx.get(f"{self.client_url}/healthz", timeout=1.0)
            if response.status_code == 200:
                self.is_connected = True
                logger.info("Connected to local Zep server successfully!")
            else:
                self.is_connected = False
        except Exception:
            self.is_connected = False
            logger.warning("Local Zep server is not reachable. Falling back to local semantic database memory.")

    async def add_or_update_contact(self, user_id: str, contact_data: Dict[str, Any]):
        """
        Upsert contact documents to Zep for semantic vector indexing.
        """
        self._check_connection()
        if not self.is_connected:
            # Fallback: log locally
            logger.info(f"[Fallback Memory] Indexing contact: {contact_data.get('name')}")
            return

        try:
            # Connect and upload to local Zep collection
            # Zep CE supports collections or documents
            collection_name = f"user_{user_id}_contacts"
            
            # 1. Ensure collection exists
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.client_url}/api/v1/collections/{collection_name}",
                    json={"name": collection_name, "description": f"Contacts for user {user_id}"}
                )
                
                # 2. Document body
                document = {
                    "document_id": contact_data.get("id"),
                    "content": self.build_contact_text(contact_data),
                    "metadata": {
                        "name": contact_data.get("name"),
                        "company": contact_data.get("current_company"),
                        "role": contact_data.get("current_role"),
                        "tags": contact_data.get("tags", [])
                    }
                }
                
                # 3. Add document
                await client.post(
                    f"{self.client_url}/api/v1/collections/{collection_name}/documents",
                    json=[document]
                )
        except Exception as e:
            logger.error(f"Failed to index contact in local Zep: {e}")

    async def delete_contact(self, user_id: str, contact_id: str):
        self._check_connection()
        if not self.is_connected:
            return
        try:
            collection_name = f"user_{user_id}_contacts"
            async with httpx.AsyncClient() as client:
                await client.delete(f"{self.client_url}/api/v1/collections/{collection_name}/documents/{contact_id}")
        except Exception as e:
            logger.error(f"Failed to delete contact from Zep: {e}")

    async def search_memory(self, user_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Semantic query to retrieve the most relevant contacts for a chat session.
        """
        self._check_connection()
        if not self.is_connected:
            return []

        try:
            collection_name = f"user_{user_id}_contacts"
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.client_url}/api/v1/collections/{collection_name}/search",
                    json={"text": query, "limit": limit}
                )
                if response.status_code == 200:
                    results = response.json().get("results", [])
                    return [r.get("document", {}) for r in results]
        except Exception as e:
            logger.error(f"Failed to search Zep collection: {e}")
        return []

    def build_contact_text(self, contact: Dict[str, Any]) -> str:
        """
        Helper to flatten all fields of a contact into a semantic textual description.
        """
        name = contact.get("name", "Unknown")
        role = contact.get("current_role", "")
        company = contact.get("current_company", "")
        interests = ", ".join(contact.get("interests", [])) if isinstance(contact.get("interests"), list) else ""
        tags = ", ".join(contact.get("tags", [])) if isinstance(contact.get("tags"), list) else ""
        notes = contact.get("notes", "")
        achievements = contact.get("achievements", "")
        philosophy = contact.get("philosophy", "")
        approach = contact.get("approach_notes", "")
        how_met = contact.get("how_we_met", "")

        return f"""
        NAME: {name}
        ROLE: {role} at {company}
        TAGS: {tags}
        INTERESTS: {interests}
        HOW WE MET: {how_met}
        ACHIEVEMENTS: {achievements}
        PHILOSOPHY: {philosophy}
        APPROACH NOTES: {approach}
        NOTES: {notes}
        """

zep_service = ZepService()
