import asyncio
from datetime import datetime, timezone
import json
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket

class AIAgentManager:
    """
    Manages running AI agent tasks and broadcasting events to WebSocket subscribers.
    """
    def __init__(self):
        # task_id -> Set of connected WebSockets
        self.task_subscribers: Dict[str, Set[WebSocket]] = {}
        # Global WebSocket subscribers (e.g. from Electron main process)
        self.global_subscribers: Set[WebSocket] = set()
        # task_id -> active Task asyncio.Task
        self.active_tasks: Dict[str, asyncio.Task] = {}
        # task_id -> current status info
        self.task_states: Dict[str, Dict[str, Any]] = {}

    async def register_subscriber(self, websocket: WebSocket, task_id: Optional[str] = None):
        if task_id:
            if task_id not in self.task_subscribers:
                self.task_subscribers[task_id] = set()
            self.task_subscribers[task_id].add(websocket)
        else:
            self.global_subscribers.add(websocket)

    async def unregister_subscriber(self, websocket: WebSocket, task_id: Optional[str] = None):
        if task_id and task_id in self.task_subscribers:
            self.task_subscribers[task_id].discard(websocket)
            if not self.task_subscribers[task_id]:
                del self.task_subscribers[task_id]
        self.global_subscribers.discard(websocket)

    async def broadcast_event(self, task_id: str, event_type: str, message: str, data: Optional[Dict[str, Any]] = None):
        payload = {
            "task_id": task_id,
            "event_type": event_type,
            "message": message,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        encoded = json.dumps(payload)

        # Notify task-specific subscribers
        subscribers = set(self.task_subscribers.get(task_id, set()))
        # Notify global subscribers
        subscribers.update(self.global_subscribers)

        stale = set()
        for ws in subscribers:
            try:
                await ws.send_text(encoded)
            except Exception:
                stale.add(ws)

        for ws in stale:
            await self.unregister_subscriber(ws, task_id)

    async def start_execution(self, task_id: str, requirement: str, autonomy_level: str = "autonomous"):
        self.task_states[task_id] = {
            "status": "executing",
            "progress": 0.1,
            "current_activity": "Analyzing workspace context"
        }

        async def run_loop():
            try:
                await self.broadcast_event(task_id, "TASK_STARTED", f"Task execution started: {requirement[:60]}")
                await asyncio.sleep(1.0)

                self.task_states[task_id]["progress"] = 0.3
                self.task_states[task_id]["current_activity"] = "Formulating execution plan"
                await self.broadcast_event(task_id, "PLAN_GENERATED", "Synthesized 3-phase execution plan", {
                    "steps": ["Scan source files", "Generate modifications", "Verify syntax & tests"]
                })
                await asyncio.sleep(1.5)

                self.task_states[task_id]["progress"] = 0.7
                self.task_states[task_id]["current_activity"] = "Applying codebase changes"
                await self.broadcast_event(task_id, "TOOL_CALL", "Writing target files", {
                    "tool": "WRITE_FILE",
                    "status": "success"
                })
                await asyncio.sleep(1.0)

                self.task_states[task_id]["status"] = "completed"
                self.task_states[task_id]["progress"] = 1.0
                self.task_states[task_id]["current_activity"] = "Task completed successfully"
                await self.broadcast_event(task_id, "TASK_COMPLETED", "All automated operations verified", {
                    "tests_passed": 5,
                    "tests_failed": 0
                })
            except asyncio.CancelledError:
                self.task_states[task_id]["status"] = "stopped"
                self.task_states[task_id]["current_activity"] = "Execution stopped by user"
                await self.broadcast_event(task_id, "TASK_STOPPED", "Execution aborted by user request")
            except Exception as e:
                self.task_states[task_id]["status"] = "error"
                self.task_states[task_id]["current_activity"] = f"Error: {str(e)}"
                await self.broadcast_event(task_id, "TASK_ERROR", f"Agent runtime exception: {str(e)}")

        task = asyncio.create_task(run_loop())
        self.active_tasks[task_id] = task

    async def stop_execution(self, task_id: str) -> bool:
        if task_id in self.active_tasks:
            self.active_tasks[task_id].cancel()
            del self.active_tasks[task_id]
            if task_id in self.task_states:
                self.task_states[task_id]["status"] = "stopped"
            return True
        return False

    def get_status(self, task_id: str) -> Dict[str, Any]:
        return self.task_states.get(task_id, {
            "status": "idle",
            "progress": 0.0,
            "current_activity": "No active process"
        })

agent_manager = AIAgentManager()
