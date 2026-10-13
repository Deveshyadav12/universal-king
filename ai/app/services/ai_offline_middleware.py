"""
Middleware for handling AI service offline scenarios
Provides automatic fallback and online/offline status detection
"""

import os
import time
import httpx
from datetime import datetime, timedelta
from fastapi import Request
from starlette.responses import JSONResponse


class AIOfflineMiddleware:
    """
    FastAPI middleware that checks AI service availability
    and provides automatic fallback when offline.
    """
    
    def __init__(self, app):
        self.app = app
        self.last_check = None
        self.is_online = None
        self.check_interval = 30  # Check every 30 seconds
    
    async def __call__(self, request: Request, call_next):
        # Check if this is a health check
        if request.url.path == "/health":
            return await self._handle_health(request, call_next)
        
        # Check AI service status
        current_time = time.time()
        if (self.last_check is None or 
            current_time - self.last_check > self.check_interval):
            await self._check_ai_status()
        
        # Add AI status header
        response = await call_next(request)
        
        # Add custom headers
        response.headers["X-AI-Status"] = "online" if self.is_online else "offline"
        response.headers["X-AI-Checked"] = str(self.last_check)
        
        return response
    
    async def _handle_health(self, request: Request, call_next):
        """Handle health check with AI service status"""
        await self._check_ai_status()
        
        response = await call_next(request)
        
        # If response is successful, add AI status
        if response.status_code == 200:
            try:
                data = response.json()
                data["ai_online"] = bool(self.is_online)
                data["ai_checked_at"] = self.last_check
                return JSONResponse(content=data)
            except:
                pass
        
        return response
    
    async def _check_ai_status(self):
        """Check if AI service is available"""
        self.last_check = time.time()
        
        try:
            ai_url = os.getenv("HEXAWAVE_AI_URL", "http://127.0.0.1:8000")
            token = os.getenv("HEXAWAVE_AI_SERVICE_TOKEN", "")
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                headers = {}
                if token:
                    headers["X-Hexawave-Service-Token"] = token
                
                response = await client.get(
                    f"{ai_url}/health",
                    headers=headers
                )
                
                # Consider online if we get any response (even error)
                # The actual AI service will handle auth errors
                self.is_online = response.status_code < 500
                
        except Exception as e:
            # If we can't connect, we're offline
            self.is_online = False
            print(f"AI service offline check failed: {e}")


def create_ai_offline_middleware(app):
    """Factory function to create the middleware"""
    return AIOfflineMiddleware(app)


class FallbackResponse:
    """Helper to create fallback responses when AI is offline"""
    
    @staticmethod
    def create_ai_unavailable_response(endpoint: str, task: str):
        """Create a response indicating AI is unavailable"""
        return {
            "success": False,
            "error": "ai_unavailable",
            "message": f"AI service is currently offline. {task} functionality is limited.",
            "endpoint": endpoint,
            "fallback_available": True,
            "timestamp": datetime.now().isoformat()
        }
    
    @staticmethod
    def create_offline_generation_response(project_name: str, project_type: str):
        """Create a fallback response for project generation"""
        return {
            "success": True,
            "projectId": f"offline-{datetime.now().timestamp()}",
            "fallback": True,
            "offline": True,
            "files": [
                {
                    "name": "main.py",
                    "language": "python",
                    "content": f"""# {project_name}
# Generated in offline mode

def main():
    print("Hello from {project_name}!")
    # TODO: Implement your {project_type} logic here

if __name__ == "__main__":
    main()
"""
                },
                {
                    "name": "README.md",
                    "language": "markdown",
                    "content": f"""# {project_name}

This project was generated in offline mode.

## Project Type: {project_type}

## Next Steps
1. Review the generated code
2. Customize the implementation
3. Test your application

---
*AI service was offline during generation*
"""
                }
            ],
            "message": "Generated in offline mode",
            "warning": "AI service is offline. This is a template response."
        }
    
    @staticmethod
    def create_offline_score_response(lead_data: dict):
        """Create a fallback response for lead scoring"""
        score = 0
        reasons = []
        
        if lead_data.get("companyName"):
            score += 10
            reasons.append("+10: Company name is present")
        
        if lead_data.get("email"):
            score += 20
            reasons.append("+20: Contact email is available")
        
        if lead_data.get("website"):
            score += 15
            reasons.append("+15: Company website is available")
        
        if lead_data.get("industry"):
            score += 5
            reasons.append("+5: Industry information is available")
        
        qualification = (
            "HIGH_PRIORITY" if score >= 80 else
            "GOOD" if score >= 60 else
            "MEDIUM" if score >= 35 else
            "LOW"
        )
        
        return {
            "score": min(score, 100),
            "reasons": reasons,
            "qualification": qualification,
            "fallback": True,
            "offline": True,
            "message": "Lead scored using fallback logic (AI offline)"
        }
