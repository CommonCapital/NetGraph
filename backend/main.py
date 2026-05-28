import os
import uvicorn
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta

from backend.database import init_db, get_db, SessionLocal
from backend.models import User as DBUser, Contact as DBContact, Interaction as DBInteraction, contact_relations
from backend.schema import schema, Context
from backend.auth import get_password_hash, get_current_user_from_token

app = FastAPI(
    title="NetGraph API",
    description="GraphQL-powered AI Relationship Operating System backend"
)

# Configure CORS to allow our local React frontend to communicate seamlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Supports wildcard for local/mobile client endpoints
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom context getter to inject database session and active user into GraphQL
async def get_graphql_context(
    request: Request,
    db: Session = Depends(get_db)
):
    user = None
    # Extract token from Authorization header or cookie
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        
    if not token:
        token = request.cookies.get("access_token")
        if token and token.startswith("Bearer "):
            token = token.split(" ")[1]

    if token:
        user = get_current_user_from_token(token, db)
        
    return Context(db=db, user=user)

# Mount Strawberry GraphQL router
graphql_app = GraphQLRouter(
    schema,
    context_getter=get_graphql_context
)
app.include_router(graphql_app, prefix="/graphql")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "netgraph-api"}

# --- DB Seeding Engine ---
def seed_data():
    db = SessionLocal()
    try:
        # Check if users already exist
        if db.query(DBUser).count() > 0:
            return

        print("Seeding initial NetGraph database with premium operator demo data...")
        
        # 1. Create Demo User
        demo_user = DBUser(
            username="demo",
            email="demo@netgraph.ai",
            password_hash=get_password_hash("password123"),
            display_name="Demo Operator",
            bio="Active early-stage builder and connector. Exploring logistics and AI infrastructure."
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)

        # 2. Seed Contacts
        # Contact A: John Sterling (VC)
        john = DBContact(
            owner_id=demo_user.id,
            name="John Sterling",
            type="text",
            email="john@foundersfund.com",
            phone="+1 (555) 129-3847",
            linkedin_url="https://linkedin.com/in/john-sterling-demo",
            telegram_handle="john_sterling_ff",
            current_role="Partner",
            current_company="Founders Fund",
            experience=[
                {"role": "VP Tech Strategy", "company": "SpaceX", "startYear": 2018, "endYear": 2021, "current": False},
                {"role": "Principal", "company": "Founders Fund", "startYear": 2021, "endYear": 2023, "current": False}
            ],
            interests=["Deep Tech", "Fusion Energy", "Skiing", "Ancient Philosophy"],
            achievements="Led Series A investments in 3 major robotics and energy unicorn startups.",
            philosophy="Back extreme, obsessive founders who live and die by their vision. Hates consensus.",
            lifestyle="Constantly traveling between SF and Miami. Prefers quick Telegram messages.",
            approach_notes="Extremely responsive on Telegram. Skip the pitch, focus directly on the hard technical hurdles.",
            how_we_met="Introduced at an AI/Robotics summit in Miami last year.",
            tags=["Investor", "Advisor", "Deep Tech"],
            notes="John is an exceptional deep tech thinker. He believes the logistics sector is ripe for next-gen physical automation. Keep in touch monthly."
        )
        db.add(john)

        # Contact B: Sarah Jenkins (Engineering Executive)
        sarah = DBContact(
            owner_id=demo_user.id,
            name="Sarah Jenkins",
            type="text",
            email="sarah.jenkins@palantir.com",
            phone="+1 (555) 438-9281",
            linkedin_url="https://linkedin.com/in/sarah-jenkins-palantir",
            current_role="VP of Engineering",
            current_company="Palantir Technologies",
            experience=[
                {"role": "Lead Systems Architect", "company": "Lockheed Martin", "startYear": 2015, "endYear": 2019, "current": False},
                {"role": "Director of Core Infrastructure", "company": "Palantir", "startYear": 2019, "endYear": 2023, "current": False}
            ],
            interests=["Logistics Systems", "AI Scaling", "Baking", "Marathons"],
            achievements="Architected Palantir's latest real-time supply-chain intelligence layout.",
            philosophy="Values architectural simplicity and crisp, direct execution. Absolutely despises buzzwords.",
            lifestyle="Early riser. Extremely disciplined. Avoid long meetings; prefers structured 15-minute syncs.",
            approach_notes="Always approach with a specific, hard problem statement. Do not talk about 'AI' as a generic term.",
            how_we_met="Introduced by John Sterling (Founders Fund).",
            tags=["Operator", "Palantir", "Logistics", "AI Specialist"],
            notes="Sarah is a legend in high-scale logistics architectures. Extremely analytical. She could be the ultimate advisor or hire for any supply-chain venture."
        )
        db.add(sarah)

        # Contact C: Michael Chang (Quant Trading)
        michael = DBContact(
            owner_id=demo_user.id,
            name="Michael Chang",
            type="text",
            email="m.chang@citadel.com",
            phone="+1 (555) 831-2947",
            linkedin_url="https://linkedin.com/in/michael-chang-demo",
            current_role="Co-Founder, Commodities HFT",
            current_company="Citadel Securities",
            interests=["Commodities Trading", "Stochastic Calculus", "High Stakes Poker", "Espresso"],
            achievements="Created a multi-billion dollar commodity arbitrage pricing model.",
            philosophy="Strict Bayesian rationalist. Views everything in life as expected value calculations.",
            lifestyle="Works late. Hates small talk. Enjoys fine wine and highly technical deep dives.",
            approach_notes="Do not ask 'How is it going?'. Pitch a unique angle about global energy flow changes.",
            how_we_met="Met at a mathematical computing conference in Boston.",
            tags=["Quant", "Finance", "Founder"],
            notes="Michael has unmatched insight into global physical flows. He knows everybody in shipping and bulk commodity transport."
        )
        db.add(michael)

        # Contact D: Amara Diallo (Goldman Sachs MD)
        amara = DBContact(
            owner_id=demo_user.id,
            name="Amara Diallo",
            type="text",
            email="amara.diallo@gs.com",
            linkedin_url="https://linkedin.com/in/amara-diallo-gs-demo",
            current_role="Managing Director",
            current_company="Goldman Sachs",
            interests=["Corporate Finance", "Mergers & Acquisitions", "Golf", "Art History"],
            achievements="Advised on the largest logistics M&A transaction of the decade ($8.5B).",
            philosophy="Relationships and trust are the only assets that appreciate over time.",
            lifestyle="Values traditional professional etiquette. Prefers phone calls and dinner meetings.",
            approach_notes="Very relationship-driven. Reach out before holidays. Prefer phone call over email.",
            how_we_met="Worked together on a logistics joint-venture corporate client audit.",
            tags=["Finance", "M&A", "Logistics"],
            notes="Amara is connected to every major executive in retail and bulk transport. High integrity. Excellent sponsor."
        )
        db.add(amara)

        # Contact E: James Carter (AI Developer - NEGLECTED)
        james = DBContact(
            owner_id=demo_user.id,
            name="James Carter",
            type="text",
            email="james.carter@ai-logistics.io",
            current_role="Lead Software Engineer",
            current_company="AI Logistics",
            interests=["Neural Networks", "Reinforcement Learning", "Hiking", "Vinyl Records"],
            achievements="Built a reinforcement-based fleet dispatching optimizer.",
            philosophy="Open source everything. Build for utility, not hype.",
            approach_notes="Casual reach out. Coffee or beers. Enjoys talking about vinyl and retro gear.",
            how_we_met="Met at a local startup networking night.",
            tags=["Developer", "AI Specialist", "Logistics"],
            notes="James is a top-tier engineer. He is currently looking for his next big challenge since his company got acquired."
        )
        db.add(james)

        db.commit() # Save contacts to database to generate IDs

        # 3. Create Graph Linkages (John introduced Sarah)
        sarah.introduced_by = john.id
        
        # 4. Create related contacts links (John knows Sarah)
        john.related_to.append(sarah)
        sarah.related_to.append(john)
        
        # 5. Seed Interactions
        # Sarah: interaction 2 weeks ago
        int_sarah = DBInteraction(
            contact_id=sarah.id,
            owner_id=demo_user.id,
            date=date.today() - timedelta(days=14),
            note="Quick phone sync. Reviewed their recent supply-chain release. She gave great critiques on neural path algorithms."
        )
        db.add(int_sarah)

        # John: interaction 5 days ago
        int_john = DBInteraction(
            contact_id=john.id,
            owner_id=demo_user.id,
            date=date.today() - timedelta(days=5),
            note="Met for coffee in SF. Shared our fund thesis on robotic warehousing. He loves it and wants to see the pitch deck."
        )
        db.add(int_john)

        # James: NEGLECTED interaction 100 days ago
        int_james = DBInteraction(
            contact_id=james.id,
            owner_id=demo_user.id,
            date=date.today() - timedelta(days=100),
            note="Initial meetup. Discussed his reinforcement algorithm. Extremely smart guy. Need to check in about his transition plans."
        )
        db.add(int_james)

        db.commit()
        print("Database seeded successfully with 5 premium CRM contacts!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    # Initialize SQL database tables
    init_db()
    # Populate with demo data if empty
    seed_data()

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8080, reload=True)
