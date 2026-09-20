"""
Demo Project Seeder
Run: python backend/scripts/seed_demo_project.py

Creates a sample React + FastAPI demo project at /tmp/demo_project (or C:\\Temp\\demo_project on Windows)
and populates the database with 3 completed tasks showing different agent scenarios.
"""
import asyncio
import json
import os
import sys
import platform
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Ensure backend package is importable
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from backend.config import settings
from backend.models.project import Base, Project, Task, TaskEvent, AgentMemory, AuditLog

DATABASE_URL = settings.database_url


DEMO_ROOT = Path("C:/Temp/demo_project") if platform.system() == "Windows" else Path("/tmp/demo_project")


DEMO_FILES = {
    "README.md": "# EduSim Demo\nA classroom simulation platform built with React and FastAPI.\n",
    "package.json": json.dumps({
        "name": "edusim-frontend",
        "version": "1.0.0",
        "dependencies": {"react": "^18.2.0", "axios": "^1.4.0", "zustand": "^4.4.0"},
        "devDependencies": {"vite": "^5.0.0", "typescript": "^5.2.0", "vitest": "^1.0.0"}
    }, indent=2),
    "src/App.tsx": """import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { LoginPage } from './pages/LoginPage';

export const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  </BrowserRouter>
);
""",
    "src/pages/Dashboard.tsx": """import React from 'react';
export const Dashboard: React.FC = () => {
  return <div className="p-8"><h1>EduSim Dashboard</h1></div>;
};
""",
    "src/pages/LoginPage.tsx": """import React, { useState } from 'react';
export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: add validation
  };
  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
      <button type="submit">Login</button>
    </form>
  );
};
""",
    "src/components/ClassroomCard.tsx": """import React from 'react';
interface Props { name: string; students: number; }
export const ClassroomCard: React.FC<Props> = ({ name, students }) => (
  <div className="card">
    <h3>{name}</h3>
    <p>{students} students</p>
  </div>
);
""",
    "src/services/api.ts": """import axios from 'axios';
const client = axios.create({ baseURL: 'http://localhost:8000/api' });
export const getClassrooms = () => client.get('/classrooms');
export const enrollStudent = (classroomId: string, studentId: string) =>
  client.post(`/classrooms/${classroomId}/enroll`, { student_id: studentId });
""",
    "backend/main.py": """from fastapi import FastAPI
from backend.routers import classrooms, students, auth
app = FastAPI(title='EduSim API')
app.include_router(classrooms.router, prefix='/api/classrooms')
app.include_router(students.router, prefix='/api/students')
app.include_router(auth.router, prefix='/api/auth')
""",
    "backend/models/classroom.py": """from sqlalchemy import Column, String, Integer
from database import Base
class Classroom(Base):
    __tablename__ = 'classrooms'
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    capacity = Column(Integer, default=30)
""",
    "backend/models/user.py": """from sqlalchemy import Column, String, Boolean
from database import Base
class User(Base):
    __tablename__ = 'users'
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
""",
    "tests/test_classrooms.py": """import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_list_classrooms():
    async with AsyncClient(base_url='http://localhost:8000') as client:
        resp = await client.get('/api/classrooms')
    assert resp.status_code == 200

@pytest.mark.asyncio
async def test_enroll_student():
    async with AsyncClient(base_url='http://localhost:8000') as client:
        resp = await client.post('/api/classrooms/cls-1/enroll', json={'student_id': 'stu-1'})
    assert resp.status_code == 200
""",
    "tests/test_auth.py": """import pytest

def test_login_success():
    # Placeholder - replace with actual test
    assert True

def test_login_invalid_password():
    assert True
""",
}


def create_demo_files():
    print(f"Creating demo project at {DEMO_ROOT}...")
    DEMO_ROOT.mkdir(parents=True, exist_ok=True)
    for rel_path, content in DEMO_FILES.items():
        full_path = DEMO_ROOT / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content, encoding="utf-8")
    print(f"  Created {len(DEMO_FILES)} demo files.")


def utcnow(delta_hours=0):
    return datetime.now(timezone.utc) - timedelta(hours=delta_hours)


async def seed_database():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        # Idempotent: check if project already exists
        from sqlalchemy import select
        existing = await session.execute(select(Project).where(Project.path == str(DEMO_ROOT)))
        project = existing.scalar_one_or_none()

        if not project:
            project = Project(
                id="demo-project-001",
                name="EduSim",
                path=str(DEMO_ROOT),
                language="TypeScript",
                framework="React + FastAPI",
                last_opened=utcnow(1),
                config_json=json.dumps({"package_manager": "npm", "test_framework": "vitest"}),
            )
            session.add(project)
            await session.flush()
            print("  Created demo project in DB.")
        else:
            print("  Demo project already exists, re-seeding tasks...")

        # --- Task 1: Normal successful task ---
        t1 = Task(
            id="demo-task-001",
            project_id=project.id,
            requirement="Add student enrollment count to the classroom card component",
            status="completed",
            created_at=utcnow(5),
            completed_at=utcnow(4),
            execution_time_seconds=63.4,
            files_changed=2,
            tests_passed=8,
            tests_failed=0,
            recovery_attempts=0,
            compiled_spec_json=json.dumps({
                "intent": "Show enrollment count in ClassroomCard",
                "requirements": ["Add enrolledCount prop", "Display with student icon"],
                "affected_files": ["src/components/ClassroomCard.tsx"],
                "confidence_score": 0.93,
                "risk_level": "low"
            })
        )
        session.add(t1)

        for evt in [
            ("planning", "Building execution plan from compiled spec", utcnow(5)),
            ("reading", "Read src/components/ClassroomCard.tsx", utcnow(4.95)),
            ("writing", "Patched ClassroomCard.tsx — added enrolledCount prop and badge", utcnow(4.9)),
            ("testing", "Running: npm test", utcnow(4.85)),
            ("verification", "8/8 tests passed", utcnow(4.82)),
            ("git_checkpoint", "Checkpoint: git commit a3f9c12", utcnow(4.8)),
            ("completed", "Task completed successfully in 63s", utcnow(4.78)),
        ]:
            session.add(TaskEvent(
                task_id=t1.id,
                event_type=evt[0],
                message=evt[1],
                timestamp=evt[2],
                data_json=None
            ))

        for al in [
            ("file_write", "Patched src/components/ClassroomCard.tsx"),
            ("command_run", "npm test — 8 passed, 0 failed"),
            ("git_commit", "[AutoDev] Add enrollment count to ClassroomCard"),
        ]:
            session.add(AuditLog(
                project_id=project.id,
                task_id=t1.id,
                action_type=al[0],
                description=al[1],
                timestamp=utcnow(4.9),
            ))

        # --- Task 2: Task with recovery ---
        t2 = Task(
            id="demo-task-002",
            project_id=project.id,
            requirement="Add JWT authentication to the login API endpoint",
            status="completed",
            created_at=utcnow(26),
            completed_at=utcnow(25),
            execution_time_seconds=142.7,
            files_changed=4,
            tests_passed=12,
            tests_failed=0,
            recovery_attempts=2,
            compiled_spec_json=json.dumps({
                "intent": "Implement JWT-based auth for POST /api/auth/login",
                "requirements": ["Generate JWT on valid credentials", "Return 401 on failure", "Add token expiry"],
                "affected_files": ["backend/routers/auth.py", "backend/models/user.py"],
                "confidence_score": 0.81,
                "risk_level": "medium"
            })
        )
        session.add(t2)

        for evt in [
            ("planning", "Analyzing JWT integration requirements", utcnow(26)),
            ("reading", "Read backend/routers/auth.py", utcnow(25.95)),
            ("writing", "Patched auth.py — added JWT token generation", utcnow(25.9)),
            ("testing", "Running: pytest tests/test_auth.py", utcnow(25.85)),
            ("error", "ImportError: jose not installed", utcnow(25.8)),
            ("recovery", "Recovery attempt 1: Adding python-jose to requirements.txt", utcnow(25.7)),
            ("testing", "Running: pytest tests/test_auth.py (retry)", utcnow(25.6)),
            ("error", "AssertionError: token expiry field missing", utcnow(25.55)),
            ("recovery", "Recovery attempt 2: Adding exp claim to token payload", utcnow(25.4)),
            ("testing", "Running: pytest tests/test_auth.py (retry 2)", utcnow(25.3)),
            ("verification", "12/12 tests passed", utcnow(25.25)),
            ("git_checkpoint", "Checkpoint: git commit b7d4e89", utcnow(25.2)),
            ("completed", "Task completed after 2 recovery attempts in 143s", utcnow(25.18)),
        ]:
            session.add(TaskEvent(
                task_id=t2.id,
                event_type=evt[0],
                message=evt[1],
                timestamp=evt[2],
            ))

        for al in [
            ("file_write", "Patched backend/routers/auth.py — JWT token generation"),
            ("command_run", "pytest tests/test_auth.py — failed (ImportError)"),
            ("file_write", "Updated requirements.txt — added python-jose"),
            ("command_run", "pytest tests/test_auth.py — 12 passed"),
            ("git_commit", "[AutoDev] Add JWT auth to login endpoint"),
        ]:
            session.add(AuditLog(
                project_id=project.id,
                task_id=t2.id,
                action_type=al[0],
                description=al[1],
                timestamp=utcnow(25.5),
            ))

        # --- Task 3: Human intervention required ---
        t3 = Task(
            id="demo-task-003",
            project_id=project.id,
            requirement="Deploy application to production using Docker Compose",
            status="completed",
            created_at=utcnow(50),
            completed_at=utcnow(49),
            execution_time_seconds=287.3,
            files_changed=3,
            tests_passed=15,
            tests_failed=0,
            recovery_attempts=0,
            human_interventions=1,
            compiled_spec_json=json.dumps({
                "intent": "Containerize and deploy with Docker Compose",
                "requirements": ["Generate Dockerfile", "Generate docker-compose.yml", "Set up env vars"],
                "affected_files": ["Dockerfile", "docker-compose.yml", ".env.example"],
                "confidence_score": 0.74,
                "risk_level": "high"
            })
        )
        session.add(t3)

        for evt in [
            ("planning", "Analyzing Docker deployment strategy", utcnow(50)),
            ("reading", "Read package.json and backend/main.py", utcnow(49.95)),
            ("writing", "Generated Dockerfile (multi-stage build)", utcnow(49.9)),
            ("writing", "Generated docker-compose.yml", utcnow(49.85)),
            ("approval_request", "Deploy to production? This will overwrite existing containers.", utcnow(49.8)),
            ("human_intervention", "User approved deployment action", utcnow(49.5)),
            ("command_run", "docker compose up --build -d", utcnow(49.4)),
            ("verification", "Health check passed: http://localhost:8000/health", utcnow(49.2)),
            ("git_checkpoint", "Checkpoint: git commit c9a2f31", utcnow(49.15)),
            ("completed", "Task completed with 1 human approval in 287s", utcnow(49.1)),
        ]:
            session.add(TaskEvent(
                task_id=t3.id,
                event_type=evt[0],
                message=evt[1],
                timestamp=evt[2],
            ))

        for al in [
            ("file_write", "Generated Dockerfile — multi-stage React + FastAPI"),
            ("file_write", "Generated docker-compose.yml — app + db services"),
            ("permission_override", "User approved deployment to production environment"),
            ("command_run", "docker compose up --build -d"),
            ("git_commit", "[AutoDev] Add Docker Compose deployment configuration"),
        ]:
            session.add(AuditLog(
                project_id=project.id,
                task_id=t3.id,
                action_type=al[0],
                description=al[1],
                timestamp=utcnow(49.5),
                user_initiated=(al[0] == "permission_override"),
            ))

        # Agent memories
        session.add(AgentMemory(
            project_id=project.id,
            memory_type="architecture",
            content="Project uses React 18 + FastAPI. Frontend at port 5173, backend at 8000. SQLite for dev, PostgreSQL for prod.",
        ))
        session.add(AgentMemory(
            project_id=project.id,
            memory_type="decision",
            content="Chose python-jose for JWT (not PyJWT) because existing codebase had jose installed as transitive dep.",
        ))
        session.add(AgentMemory(
            project_id=project.id,
            memory_type="bug",
            content="Fixed JWT ImportError by adding python-jose to requirements.txt during Task 2 recovery.",
        ))

        await session.commit()
        print("  Seeded 3 tasks, events, audit logs, and memories into DB.")

    await engine.dispose()


async def main():
    print("=" * 50)
    print("  Autonomous IDE — Demo Project Seeder")
    print("=" * 50)
    create_demo_files()
    await seed_database()
    print("\n✓ Done! Open the app and load:", str(DEMO_ROOT))
    print("  The project will appear pre-loaded with 3 tasks and audit history.")


if __name__ == "__main__":
    asyncio.run(main())
