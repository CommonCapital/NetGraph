import strawberry
from typing import List, Optional
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import or_
import logging

from backend.models import User as DBUser, Contact as DBContact, Interaction as DBInteraction, Connection as DBConnection
from backend.auth import get_password_hash, verify_password, create_access_token
from backend.services.zep_service import zep_service
from backend.services.ai_service import ai_service

from strawberry.fastapi import BaseContext

logger = logging.getLogger("netgraph.graphql")

# --- Context definition ---
class Context(BaseContext):
    db: Session
    user: Optional[DBUser]

    def __init__(self, db: Session, user: Optional[DBUser] = None):
        super().__init__()
        self.db = db
        self.user = user

Info = strawberry.Info[Context, None]

from enum import Enum

# --- GraphQL Enums ---
@strawberry.enum
class ContactType(Enum):
    TEXT = "text"
    USER = "user"

@strawberry.enum
class ConnectionStatus(Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"

# --- GraphQL Types ---
@strawberry.type
class Experience:
    role: str
    company: str
    startYear: Optional[int] = None
    endYear: Optional[int] = None
    current: Optional[bool] = None

@strawberry.input
class ExperienceInput:
    role: str
    company: str
    startYear: Optional[int] = None
    endYear: Optional[int] = None
    current: Optional[bool] = None

@strawberry.type
class Interaction:
    id: strawberry.ID
    date: str
    note: Optional[str] = None

@strawberry.type
class User:
    id: strawberry.ID
    username: str
    displayName: Optional[str] = None
    bio: Optional[str] = None
    avatarUrl: Optional[str] = None

    @strawberry.field
    def contacts(self, info: Info) -> List["Contact"]:
        db = info.context.db
        db_contacts = db.query(DBContact).filter(DBContact.owner_id == self.id, DBContact.archived == False).all()
        return [Contact.from_db(c) for c in db_contacts]

    @strawberry.field
    def connections(self, info: Info) -> List["User"]:
        db = info.context.db
        # Get accepted connections where this user is requester or receiver
        conns = db.query(DBConnection).filter(
            or_(
                DBConnection.requester_id == self.id,
                DBConnection.receiver_id == self.id
            ),
            DBConnection.status == "accepted"
        ).all()
        
        friends = []
        for c in conns:
            friend_id = c.receiver_id if c.requester_id == self.id else c.requester_id
            db_friend = db.query(DBUser).filter(DBUser.id == friend_id).first()
            if db_friend:
                friends.append(User.from_db(db_friend))
        return friends

    @strawberry.field
    def connectionCount(self, info: Info) -> int:
        return len(self.connections(info))

    @classmethod
    def from_db(cls, u: DBUser):
        return cls(
            id=strawberry.ID(u.id),
            username=u.username,
            displayName=u.display_name,
            bio=u.bio,
            avatarUrl=u.avatar_url
        )

@strawberry.type
class Contact:
    id: strawberry.ID
    name: str
    type: ContactType
    linkedUser: Optional[User] = None

    # Details
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedinUrl: Optional[str] = None
    xUrl: Optional[str] = None
    instagramUrl: Optional[str] = None
    telegramHandle: Optional[str] = None

    # Professional
    currentRole: Optional[str] = None
    currentCompany: Optional[str] = None
    experience: List[Experience] = strawberry.field(default_factory=list)

    # Personal
    interests: List[str] = strawberry.field(default_factory=list)
    achievements: Optional[str] = None
    philosophy: Optional[str] = None
    lifestyle: Optional[str] = None
    approachNotes: Optional[str] = None

    # Relationship
    howWeMet: Optional[str] = None
    introducedBy: Optional["Contact"] = None
    tags: List[str] = strawberry.field(default_factory=list)
    notes: Optional[str] = None
    archived: bool = False
    createdAt: str = ""
    updatedAt: str = ""

    @strawberry.field
    def relatedTo(self, info: Info) -> List["Contact"]:
        db = info.context.db
        db_contact = db.query(DBContact).filter(DBContact.id == self.id).first()
        if not db_contact:
            return []
        return [Contact.from_db(r) for r in db_contact.related_to]

    @strawberry.field
    def interactions(self, info: Info) -> List[Interaction]:
        db = info.context.db
        db_ints = db.query(DBInteraction).filter(DBInteraction.contact_id == self.id).order_by(DBInteraction.date.desc()).all()
        return [Interaction(id=strawberry.ID(i.id), date=i.date.isoformat(), note=i.note) for i in db_ints]

    @classmethod
    def from_db(cls, c: DBContact):
        exp_list = []
        for e in (c.experience or []):
            exp_list.append(Experience(
                role=e.get("role", ""),
                company=e.get("company", ""),
                startYear=e.get("startYear"),
                endYear=e.get("endYear"),
                current=e.get("current")
            ))
            
        return cls(
            id=strawberry.ID(c.id),
            name=c.name,
            type=ContactType(c.type) if c.type else ContactType.TEXT,
            linkedUser=User.from_db(c.linked_user) if c.linked_user else None,
            email=c.email,
            phone=c.phone,
            linkedinUrl=c.linkedin_url,
            xUrl=c.x_url,
            instagramUrl=c.instagram_url,
            telegramHandle=c.telegram_handle,
            currentRole=c.current_role,
            currentCompany=c.current_company,
            experience=exp_list,
            interests=c.interests or [],
            achievements=c.achievements,
            philosophy=c.philosophy,
            lifestyle=c.lifestyle,
            approachNotes=c.approach_notes,
            howWeMet=c.how_we_met,
            introducedBy=Contact.from_db(c.introducer) if c.introducer else None,
            tags=c.tags or [],
            notes=c.notes,
            archived=c.archived,
            createdAt=c.created_at.isoformat(),
            updatedAt=c.updated_at.isoformat()
        )

@strawberry.type
class Connection:
    id: strawberry.ID
    requester: User
    receiver: User
    status: ConnectionStatus
    createdAt: str

# --- Inputs ---
@strawberry.input
class ContactInput:
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedinUrl: Optional[str] = None
    xUrl: Optional[str] = None
    instagramUrl: Optional[str] = None
    telegramHandle: Optional[str] = None
    currentRole: Optional[str] = None
    currentCompany: Optional[str] = None
    experience: Optional[List[ExperienceInput]] = None
    interests: Optional[List[str]] = None
    achievements: Optional[str] = None
    philosophy: Optional[str] = None
    lifestyle: Optional[str] = None
    approachNotes: Optional[str] = None
    howWeMet: Optional[str] = None
    introducedBy: Optional[strawberry.ID] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None

@strawberry.type
class AuthToken:
    accessToken: str
    tokenType: str
    user: User

# --- Queries ---
@strawberry.type
class Query:
    @strawberry.field
    def me(self, info: Info) -> Optional[User]:
        if not info.context.user:
            return None
        return User.from_db(info.context.user)

    @strawberry.field
    def contact(self, info: Info, id: strawberry.ID) -> Optional[Contact]:
        if not info.context.user:
            return None
        db = info.context.db
        db_contact = db.query(DBContact).filter(DBContact.id == id, DBContact.owner_id == info.context.user.id).first()
        if not db_contact:
            return None
        return Contact.from_db(db_contact)

    @strawberry.field
    def contacts(
        self,
        info: Info,
        search: Optional[str] = None,
        tags: Optional[List[str]] = None,
        type: Optional[ContactType] = None,
        archived: Optional[bool] = False
    ) -> List[Contact]:
        if not info.context.user:
            return []
        
        db = info.context.db
        query = db.query(DBContact).filter(
            DBContact.owner_id == info.context.user.id,
            DBContact.archived == archived
        )

        # Filters
        if type:
            query = query.filter(DBContact.type == type.value)
            
        db_contacts = query.all()
        
        # Apply search and tag filtering in Python to support complex JSON/Tag arrays simply
        filtered = []
        for c in db_contacts:
            # Tag match
            if tags:
                c_tags = set(c.tags or [])
                if not set(tags).issubset(c_tags):
                    continue
            
            # Text Search
            if search:
                s = search.lower()
                text_block = f"{c.name} {c.email or ''} {c.current_role or ''} {c.current_company or ''} {c.notes or ''}".lower()
                if s not in text_block:
                    continue
            
            filtered.append(Contact.from_db(c))
            
        return filtered

    @strawberry.field
    def searchUsers(self, info: Info, username: str) -> List[User]:
        if not info.context.user:
            return []
        db = info.context.db
        db_users = db.query(DBUser).filter(
            DBUser.username.ilike(f"%{username}%"),
            DBUser.id != info.context.user.id
        ).all()
        return [User.from_db(u) for u in db_users]

    @strawberry.field
    def pendingRequests(self, info: Info) -> List[Connection]:
        if not info.context.user:
            return []
        db = info.context.db
        db_conns = db.query(DBConnection).filter(
            DBConnection.receiver_id == info.context.user.id,
            DBConnection.status == "pending"
        ).all()
        
        conns = []
        for c in db_conns:
            conns.append(Connection(
                id=strawberry.ID(c.id),
                requester=User.from_db(c.requester),
                receiver=User.from_db(c.receiver),
                status=ConnectionStatus(c.status),
                createdAt=c.created_at.isoformat()
            ))
        return conns

    @strawberry.field
    def networkContacts(self, info: Info, userId: strawberry.ID) -> List[Contact]:
        """
        Browse network contacts of a friend if connected.
        Respects privacy: only returns public fields (name, role, company, type).
        """
        if not info.context.user:
            return []
        db = info.context.db
        
        # Verify active connection exists between me and the user
        connected = db.query(DBConnection).filter(
            or_(
                (DBConnection.requester_id == info.context.user.id) & (DBConnection.receiver_id == userId),
                (DBConnection.requester_id == userId) & (DBConnection.receiver_id == info.context.user.id)
            ),
            DBConnection.status == "accepted"
        ).first()
        
        if not connected:
            return []
            
        # Get public details of that user's contacts
        db_contacts = db.query(DBContact).filter(
            DBContact.owner_id == userId,
            DBContact.archived == False
        ).all()
        
        public_contacts = []
        for c in db_contacts:
            # We strip private fields to protect privacy as per the technical spec
            public_contacts.append(Contact(
                id=strawberry.ID(c.id),
                name=c.name,
                type=ContactType(c.type) if c.type else ContactType.TEXT,
                currentRole=c.current_role,
                currentCompany=c.current_company,
                # Clear all other fields for security
                email=None, phone=None, linkedinUrl=None, xUrl=None, instagramUrl=None, telegramHandle=None,
                experience=[], interests=[], achievements=None, philosophy=None, lifestyle=None, approachNotes=None,
                howWeMet=None, introducedBy=None, tags=[], notes=None, archived=False
            ))
        return public_contacts

    # AI Chat query hook
    @strawberry.field
    async def askAI(self, info: Info, message: str, sessionId: str) -> str:
        if not info.context.user:
            return "Unauthorized. Please login to chat with the AI."
        
        db = info.context.db
        # Fetch all active contacts to use as LLM reasoning context
        db_contacts = db.query(DBContact).filter(
            DBContact.owner_id == info.context.user.id,
            DBContact.archived == False
        ).all()
        
        return await ai_service.generate_chat_response(message, db_contacts, sessionId)

# --- Mutations ---
@strawberry.type
class Mutation:
    # Profile Mutations
    @strawberry.mutation
    def updateProfile(
        self, 
        info: Info, 
        displayName: Optional[str] = None, 
        bio: Optional[str] = None, 
        avatarUrl: Optional[str] = None
    ) -> User:
        if not info.context.user:
            raise Exception("Not authenticated")
        db = info.context.db
        user = db.query(DBUser).filter(DBUser.id == info.context.user.id).first()
        if not user:
            raise Exception("User not found")
            
        if displayName is not None:
            user.display_name = displayName
        if bio is not None:
            user.bio = bio
        if avatarUrl is not None:
            user.avatar_url = avatarUrl
            
        db.commit()
        db.refresh(user)
        return User.from_db(user)

    # Auth Mutations
    @strawberry.mutation
    def registerUser(self, info: Info, username: str, email: str, password: str, displayName: Optional[str] = None) -> AuthToken:
        db = info.context.db
        # Check uniqueness
        if db.query(DBUser).filter(or_(DBUser.username == username, DBUser.email == email)).first():
            raise Exception("Username or Email already registered.")
            
        new_user = DBUser(
            username=username,
            email=email,
            password_hash=get_password_hash(password),
            display_name=displayName or username
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        token = create_access_token({"sub": new_user.username})
        return AuthToken(accessToken=token, tokenType="bearer", user=User.from_db(new_user))

    @strawberry.mutation
    def loginUser(self, info: Info, username: str, password: str) -> AuthToken:
        db = info.context.db
        user = db.query(DBUser).filter(DBUser.username == username).first()
        if not user or not verify_password(password, user.password_hash):
            raise Exception("Invalid username or password.")
            
        token = create_access_token({"sub": user.username})
        return AuthToken(accessToken=token, tokenType="bearer", user=User.from_db(user))

    # Contact Mutations
    @strawberry.mutation
    async def createContact(self, info: Info, input: ContactInput) -> Contact:
        if not info.context.user:
            raise Exception("Not authenticated")
            
        db = info.context.db
        
        exp_data = []
        if input.experience:
            for exp in input.experience:
                exp_data.append({
                    "role": exp.role,
                    "company": exp.company,
                    "startYear": exp.startYear,
                    "endYear": exp.endYear,
                    "current": exp.current
                })
                
        new_contact = DBContact(
            owner_id=info.context.user.id,
            name=input.name,
            type="text",
            email=input.email,
            phone=input.phone,
            linkedin_url=input.linkedinUrl,
            x_url=input.xUrl,
            instagram_url=input.instagramUrl,
            telegram_handle=input.telegramHandle,
            current_role=input.currentRole,
            current_company=input.currentCompany,
            experience=exp_data,
            interests=input.interests or [],
            achievements=input.achievements,
            philosophy=input.philosophy,
            lifestyle=input.lifestyle,
            approach_notes=input.approachNotes,
            how_we_met=input.howWeMet,
            introduced_by=input.introducedBy,
            tags=input.tags or [],
            notes=input.notes
        )
        
        db.add(new_contact)
        db.commit()
        db.refresh(new_contact)
        
        # Add to Zep Memory Index
        contact_dict = {
            "id": new_contact.id,
            "name": new_contact.name,
            "current_role": new_contact.current_role,
            "current_company": new_contact.current_company,
            "interests": new_contact.interests,
            "tags": new_contact.tags,
            "notes": new_contact.notes,
            "achievements": new_contact.achievements,
            "philosophy": new_contact.philosophy,
            "approach_notes": new_contact.approach_notes,
            "how_we_met": new_contact.how_we_met
        }
        await zep_service.add_or_update_contact(info.context.user.id, contact_dict)
        
        return Contact.from_db(new_contact)

    @strawberry.mutation
    async def updateContact(self, info: Info, id: strawberry.ID, input: ContactInput) -> Contact:
        if not info.context.user:
            raise Exception("Not authenticated")
            
        db = info.context.db
        contact = db.query(DBContact).filter(DBContact.id == id, DBContact.owner_id == info.context.user.id).first()
        if not contact:
            raise Exception("Contact not found")
            
        # Update details if provided
        for field in ["name", "email", "phone", "linkedinUrl", "xUrl", "instagramUrl", "telegramHandle", 
                      "currentRole", "currentCompany", "interests", "achievements", "philosophy", 
                      "lifestyle", "approachNotes", "howWeMet", "introducedBy", "tags", "notes"]:
            val = getattr(input, field, None)
            if val is not None:
                # Map camelCase to snake_case
                snake_name = "".join(["_" + c.lower() if c.isupper() else c for c in field]).lstrip("_")
                # Special cases
                if snake_name == "introduced_by" and val == "":
                    setattr(contact, "introduced_by", None)
                else:
                    setattr(contact, snake_name, val)
                
        if input.experience is not None:
            exp_data = []
            for exp in input.experience:
                exp_data.append({
                    "role": exp.role,
                    "company": exp.company,
                    "startYear": exp.startYear,
                    "endYear": exp.endYear,
                    "current": exp.current
                })
            contact.experience = exp_data

        db.commit()
        db.refresh(contact)
        
        # Update Zep Semantic Vector Index
        contact_dict = {
            "id": contact.id,
            "name": contact.name,
            "current_role": contact.current_role,
            "current_company": contact.current_company,
            "interests": contact.interests,
            "tags": contact.tags,
            "notes": contact.notes,
            "achievements": contact.achievements,
            "philosophy": contact.philosophy,
            "approach_notes": contact.approach_notes,
            "how_we_met": contact.how_we_met
        }
        await zep_service.add_or_update_contact(info.context.user.id, contact_dict)
        
        return Contact.from_db(contact)

    @strawberry.mutation
    async def deleteContact(self, info: Info, id: strawberry.ID) -> bool:
        if not info.context.user:
            raise Exception("Not authenticated")
        db = info.context.db
        contact = db.query(DBContact).filter(DBContact.id == id, DBContact.owner_id == info.context.user.id).first()
        if not contact:
            return False
            
        db.delete(contact)
        db.commit()
        
        # Remove from Zep Index
        await zep_service.delete_contact(info.context.user.id, id)
        return True

    @strawberry.mutation
    def archiveContact(self, info: Info, id: strawberry.ID) -> Contact:
        if not info.context.user:
            raise Exception("Not authenticated")
        db = info.context.db
        contact = db.query(DBContact).filter(DBContact.id == id, DBContact.owner_id == info.context.user.id).first()
        if not contact:
            raise Exception("Contact not found")
            
        contact.archived = not contact.archived
        db.commit()
        db.refresh(contact)
        return Contact.from_db(contact)

    @strawberry.mutation
    def addRelatedContact(self, info: Info, contactId: strawberry.ID, relatedId: strawberry.ID) -> Contact:
        if not info.context.user:
            raise Exception("Not authenticated")
        db = info.context.db
        
        c1 = db.query(DBContact).filter(DBContact.id == contactId, DBContact.owner_id == info.context.user.id).first()
        c2 = db.query(DBContact).filter(DBContact.id == relatedId, DBContact.owner_id == info.context.user.id).first()
        
        if not c1 or not c2:
            raise Exception("One or both contacts not found")
            
        if c2 not in c1.related_to:
            c1.related_to.append(c2)
            c2.related_to.append(c1) # Bi-directional relation in local graph
            db.commit()
            
        db.refresh(c1)
        return Contact.from_db(c1)

    @strawberry.mutation
    def removeRelatedContact(self, info: Info, contactId: strawberry.ID, relatedId: strawberry.ID) -> Contact:
        if not info.context.user:
            raise Exception("Not authenticated")
        db = info.context.db
        
        c1 = db.query(DBContact).filter(DBContact.id == contactId, DBContact.owner_id == info.context.user.id).first()
        c2 = db.query(DBContact).filter(DBContact.id == relatedId, DBContact.owner_id == info.context.user.id).first()
        
        if not c1 or not c2:
            raise Exception("One or both contacts not found")
            
        if c2 in c1.related_to:
            c1.related_to.remove(c2)
        if c1 in c2.related_to:
            c2.related_to.remove(c1)
            
        db.commit()
        db.refresh(c1)
        return Contact.from_db(c1)

    @strawberry.mutation
    def logInteraction(self, info: Info, contactId: strawberry.ID, date: str, note: Optional[str] = None) -> Interaction:
        if not info.context.user:
            raise Exception("Not authenticated")
        db = info.context.db
        
        # Verify contact ownership
        contact = db.query(DBContact).filter(DBContact.id == contactId, DBContact.owner_id == info.context.user.id).first()
        if not contact:
            raise Exception("Contact not found")
            
        dt_val = datetime.strptime(date, "%Y-%m-%d").date()
        new_int = DBInteraction(
            contact_id=contactId,
            owner_id=info.context.user.id,
            date=dt_val,
            note=note
        )
        
        db.add(new_int)
        db.commit()
        db.refresh(new_int)
        return Interaction(id=strawberry.ID(new_int.id), date=new_int.date.isoformat(), note=new_int.note)

    @strawberry.mutation
    def sendConnectionRequest(self, info: Info, receiverUsername: str) -> Connection:
        if not info.context.user:
            raise Exception("Not authenticated")
        db = info.context.db
        
        receiver = db.query(DBUser).filter(DBUser.username == receiverUsername).first()
        if not receiver:
            raise Exception("Target @username not found")
            
        if receiver.id == info.context.user.id:
            raise Exception("You cannot connect with yourself")
            
        # Check active requests or connections
        existing = db.query(DBConnection).filter(
            or_(
                (DBConnection.requester_id == info.context.user.id) & (DBConnection.receiver_id == receiver.id),
                (DBConnection.requester_id == receiver.id) & (DBConnection.receiver_id == info.context.user.id)
            )
        ).first()
        
        if existing:
            raise Exception("A connection request already exists or is accepted.")
            
        new_conn = DBConnection(
            requester_id=info.context.user.id,
            receiver_id=receiver.id,
            status="pending"
        )
        db.add(new_conn)
        db.commit()
        db.refresh(new_conn)
        
        return Connection(
            id=strawberry.ID(new_conn.id),
            requester=User.from_db(info.context.user),
            receiver=User.from_db(receiver),
            status=ConnectionStatus.PENDING,
            createdAt=new_conn.created_at.isoformat()
        )

    @strawberry.mutation
    def respondToRequest(self, info: Info, connectionId: strawberry.ID, accept: bool) -> Connection:
        if not info.context.user:
            raise Exception("Not authenticated")
        db = info.context.db
        
        conn = db.query(DBConnection).filter(
            DBConnection.id == connectionId,
            DBConnection.receiver_id == info.context.user.id
        ).first()
        
        if not conn:
            raise Exception("Connection request not found")
            
        if conn.status != "pending":
            raise Exception("Connection is already processed")
            
        if accept:
            conn.status = "accepted"
            # Upgrade any corresponding TEXT contacts to USER contacts for both sides
            c_me = db.query(DBContact).filter(DBContact.owner_id == conn.receiver_id, DBContact.email == conn.requester.email).first()
            if c_me:
                c_me.type = "user"
                c_me.linked_user_id = conn.requester_id
                
            c_them = db.query(DBContact).filter(DBContact.owner_id == conn.requester_id, DBContact.email == conn.receiver.email).first()
            if c_them:
                c_them.type = "user"
                c_them.linked_user_id = conn.receiver_id
        else:
            conn.status = "declined"
            
        db.commit()
        db.refresh(conn)
        
        return Connection(
            id=strawberry.ID(conn.id),
            requester=User.from_db(conn.requester),
            receiver=User.from_db(conn.receiver),
            status=ConnectionStatus(conn.status),
            createdAt=conn.created_at.isoformat()
        )

    @strawberry.mutation
    def linkContactToUser(self, info: Info, contactId: strawberry.ID, username: str) -> Contact:
        if not info.context.user:
            raise Exception("Not authenticated")
        db = info.context.db
        
        contact = db.query(DBContact).filter(DBContact.id == contactId, DBContact.owner_id == info.context.user.id).first()
        if not contact:
            raise Exception("Contact not found")
            
        target_user = db.query(DBUser).filter(DBUser.username == username).first()
        if not target_user:
            raise Exception("User not found with that username")
            
        # Upgrade contact link
        contact.type = "user"
        contact.linked_user_id = target_user.id
        db.commit()
        db.refresh(contact)
        return Contact.from_db(contact)

schema = strawberry.Schema(query=Query, mutation=Mutation)
