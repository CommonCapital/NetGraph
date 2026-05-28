import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Table, Date, DateTime, JSON, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base

# Many-to-Many association table for Contact relations (who knows who in your private network)
contact_relations = Table(
    "contact_relations",
    Base.metadata,
    Column("contact_id", String, ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True),
    Column("related_id", String, ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    display_name = Column(String)
    bio = Column(String)
    avatar_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    contacts = relationship("Contact", back_populates="owner", foreign_keys="Contact.owner_id", cascade="all, delete-orphan")
    linked_contacts = relationship("Contact", back_populates="linked_user", foreign_keys="Contact.linked_user_id")
    
    connections_sent = relationship("Connection", back_populates="requester", foreign_keys="Connection.requester_id", cascade="all, delete-orphan")
    connections_received = relationship("Connection", back_populates="receiver", foreign_keys="Connection.receiver_id", cascade="all, delete-orphan")

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, default="text")  # 'text' or 'user'
    linked_user_id = Column(String, ForeignKey("users.id"), nullable=True)

    # Contact details (optional)
    email = Column(String)
    phone = Column(String)
    linkedin_url = Column(String)
    x_url = Column(String)
    instagram_url = Column(String)
    telegram_handle = Column(String)

    # Professional background
    current_role = Column(String)
    current_company = Column(String)
    experience = Column(JSON, default=list)  # List of experience dicts

    # Personal information
    interests = Column(JSON, default=list)  # List of interest strings
    achievements = Column(String)
    philosophy = Column(String)
    lifestyle = Column(String)
    approach_notes = Column(String)

    # Relationship Intelligence
    how_we_met = Column(String)
    introduced_by = Column(String, ForeignKey("contacts.id"), nullable=True)
    tags = Column(JSON, default=list)  # List of tag strings

    # Notes
    notes = Column(String)

    # Meta
    archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="contacts", foreign_keys=[owner_id])
    linked_user = relationship("User", back_populates="linked_contacts", foreign_keys=[linked_user_id])
    
    introducer = relationship("Contact", remote_side=[id], foreign_keys=[introduced_by])
    interactions = relationship("Interaction", back_populates="contact", cascade="all, delete-orphan", order_by="desc(Interaction.date)")
    
    related_to = relationship(
        "Contact",
        secondary=contact_relations,
        primaryjoin=id == contact_relations.c.contact_id,
        secondaryjoin=id == contact_relations.c.related_id,
        backref="related_from"
    )

class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    note = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    contact = relationship("Contact", back_populates="interactions")

class Connection(Base):
    __tablename__ = "connections"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    requester_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="pending")  # 'pending', 'accepted', 'declined'
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    requester = relationship("User", back_populates="connections_sent", foreign_keys=[requester_id])
    receiver = relationship("User", back_populates="connections_received", foreign_keys=[receiver_id])
