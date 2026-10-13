"""
AI Client Handler - Manages AI model connections and client interactions
Provides intelligent routing, load balancing, and automatic failover
"""

import os
import json
import asyncio
import httpx
from typing import Optional, Dict, List, Any, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import defaultdict
import threading


@dataclass
class AIModel:
    """Represents an AI model configuration"""
    name: str
    endpoint: str
    api_key: str
    max_tokens: int = 4096
    timeout: int = 60
    temperature: float = 0.7
    max_retries: int = 3
    priority: int = 1
    available: bool = True
    last_checked: Optional[datetime] = None
    last_error: Optional[str] = None


@dataclass
class ClientRequest:
    """Represents a client request for AI processing"""
    request_id: str
    client_id: Optional[str] = None
    user_id: Optional[str] = None
    prompt: str
    model_preference: Optional[str] = None
    priority: int = 1
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    callback: Optional[Callable] = None


class AIClientHandler:
    """
    Handles AI client interactions with automatic routing and failover.
    Manages multiple AI models and routes requests intelligently.
    """
    
    def __init__(self):
        self.models: Dict[str, AIModel] = {}
        self.request_queue: asyncio.Queue = asyncio.Queue()
        self.active_requests: Dict[str, ClientRequest] = {}
        self.client_history: Dict[str, List[Dict]] = defaultdict(list)
        self.metrics = {
            "total_requests": 0,
            "completed_requests": 0,
            "failed_requests": 0,
            "average_response_time": 0.0,
            "last_request_time": None,
        }
        self.lock = threading.Lock()
        self._initialize_models()
        
        # Start background health checker
        self._start_health_checker()
    
    def _initialize_models(self):
        """Initialize available AI models from environment"""
        # HexaWave AI (local)
        hexawave_url = os.getenv("HEXAWAVE_AI_URL", "http://127.0.0.1:8000")
        hexawave_token = os.getenv("HEXAWAVE_AI_SERVICE_TOKEN", "")
        
        self.models["hexawave-local"] = AIModel(
            name="hexawave-local",
            endpoint=hexawave_url,
            api_key=hexawave_token,
            max_tokens=8192,
            timeout=120,
            temperature=0.7,
            priority=10,  # Highest priority for local
        )
        
        # Tavily Search
        tavily_key = os.getenv("TAVILY_API_KEY", "")
        if tavily_key:
            self.models["tavily"] = AIModel(
                name="tavily",
                endpoint="https://api.tavily.com",
                api_key=tavily_key,
                max_tokens=4096,
                timeout=30,
                temperature=0.7,
                priority=5,
            )
        
        # Azure OpenAI
        azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
        azure_key = os.getenv("AZURE_OPENAI_KEY", "")
        if azure_endpoint and azure_key:
            self.models["azure-gpt4"] = AIModel(
                name="azure-gpt4",
                endpoint=azure_endpoint,
                api_key=azure_key,
                max_tokens=8192,
                timeout=60,
                temperature=0.7,
                priority=8,
            )
        
        # OpenAI
        openai_key = os.getenv("OPENAI_API_KEY", "")
        if openai_key:
            self.models["openai-gpt4"] = AIModel(
                name="openai-gpt4",
                endpoint="https://api.openai.com/v1",
                api_key=openai_key,
                max_tokens=8192,
                timeout=60,
                temperature=0.7,
                priority=8,
            )
        
        print(f"Initialized {len(self.models)} AI models")
    
    def _start_health_checker(self):
        """Start background health checker for all models"""
        def check_health():
            while True:
                try:
                    for model_name, model in self.models.items():
                        try:
                            self.check_model_health(model_name)
                        except Exception as e:
                            print(f"Health check failed for {model_name}: {e}")
                except Exception as e:
                    print(f"Health checker error: {e}")
                
                threading.Event().wait(60)  # Check every 60 seconds
        
        checker_thread = threading.Thread(target=check_health, daemon=True)
        checker_thread.start()
    
    def check_model_health(self, model_name: str) -> bool:
        """Check if a model is healthy and available"""
        if model_name not in self.models:
            return False
        
        model = self.models[model_name]
        
        try:
            # Try to make a health check request
            if model_name == "hexawave-local":
                # Check local AI service
                import httpx
                timeout = httpx.Timeout(5.0)
                response = httpx.get(
                    f"{model.endpoint}/health",
                    headers={
                        "X-Hexawave-Service-Token": model.api_key
                    } if model.api_key else {},
                    timeout=timeout
                )
                model.available = response.status_code == 200
                model.last_checked = datetime.now()
                model.last_error = None
                return model.available
            
            elif model_name == "tavily":
                # Check Tavily
                import httpx
                response = httpx.post(
                    f"{model.endpoint}/search",
                    json={
                        "api_key": model.api_key,
                        "query": "test",
                        "max_results": 1
                    },
                    timeout=5.0
                )
                model.available = response.status_code == 200
                model.last_checked = datetime.now()
                model.last_error = None if model.available else f"HTTP {response.status_code}"
                return model.available
            
            else:
                # Generic health check
                model.available = True  # Assume available for external APIs
                model.last_checked = datetime.now()
                return True
                
        except Exception as e:
            model.available = False
            model.last_checked = datetime.now()
            model.last_error = str(e)
            return False
    
    def get_available_models(self) -> List[str]:
        """Get list of available model names"""
        return [
            name for name, model in self.models.items() 
            if model.available
        ]
    
    def get_best_model(self, preferences: Optional[List[str]] = None) -> Optional[AIModel]:
        """Get the best available model based on priority and preferences"""
        available = [
            model for model in self.models.values() 
            if model.available
        ]
        
        if not available:
            return None
        
        # Filter by preferences if provided
        if preferences:
            preferred = [
                model for model in available 
                if model.name in preferences
            ]
            if preferred:
                available = preferred
        
        # Sort by priority (descending)
        available.sort(key=lambda m: m.priority, reverse=True)
        
        return available[0] if available else None
    
    async def process_request(
        self,
        request: ClientRequest
    ) -> Dict[str, Any]:
        """Process a client request asynchronously"""
        request.request_id = request.request_id or f"req_{datetime.now().timestamp()}"
        
        # Add to queue
        await self.request_queue.put(request)
        self.active_requests[request.request_id] = request
        self.metrics["total_requests"] += 1
        
        # Process in background
        asyncio.create_task(self._process_request_worker(request))
        
        return {
            "request_id": request.request_id,
            "status": "queued",
            "message": "Request added to processing queue"
        }
    
    async def _process_request_worker(self, request: ClientRequest):
        """Worker to process a single request"""
        start_time = datetime.now()
        
        try:
            # Select best model
            model = self.get_best_model(
                [request.model_preference] if request.model_preference else None
            )
            
            if not model:
                raise RuntimeError("No AI models available")
            
            # Process based on model type
            if model.name == "hexawave-local":
                result = await self._call_hexawave(request, model)
            elif model.name == "tavily":
                result = await self._call_tavily(request, model)
            else:
                result = await self._call_generic_model(request, model)
            
            # Update metrics
            response_time = (datetime.now() - start_time).total_seconds()
            self.metrics["completed_requests"] += 1
            self.metrics["average_response_time"] = (
                (self.metrics["average_response_time"] * (self.metrics["completed_requests"] - 1) + response_time) 
                / self.metrics["completed_requests"]
            ) if self.metrics["completed_requests"] > 0 else response_time
            self.metrics["last_request_time"] = datetime.now().isoformat()
            
            # Record history
            if request.client_id:
                self.client_history[request.client_id].append({
                    "request_id": request.request_id,
                    "model": model.name,
                    "status": "completed",
                    "response_time": response_time,
                    "timestamp": datetime.now().isoformat()
                })
            
            # Execute callback if provided
            if request.callback:
                try:
                    await request.callback(result)
                except:
                    pass
            
            # Return result
            result["request_id"] = request.request_id
            result["model"] = model.name
            result["processing_time"] = response_time
            
            return result
            
        except Exception as e:
            self.metrics["failed_requests"] += 1
            
            if request.client_id:
                self.client_history[request.client_id].append({
                    "request_id": request.request_id,
                    "status": "failed",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
            
            # Try fallback model
            if request.metadata.get("retry_count", 0) < 3:
                # Retry with different model
                request.metadata["retry_count"] = request.metadata.get("retry_count", 0) + 1
                if request.model_preference:
                    # Remove preference to try other models
                    request.model_preference = None
                return await self.process_request(request)
            
            raise
        
        finally:
            # Clean up
            self.active_requests.pop(request.request_id, None)
    
    async def _call_hexawave(
        self,
        request: ClientRequest,
        model: AIModel
    ) -> Dict[str, Any]:
        """Call HexaWave AI service"""
        import httpx
        
        async with httpx.AsyncClient(timeout=model.timeout) as client:
            headers = {
                "Content-Type": "application/json",
            }
            if model.api_key:
                headers["X-Hexawave-Service-Token"] = model.api_key
            
            response = await client.post(
                f"{model.endpoint}/generate",
                json={
                    "prompt": request.prompt,
                    "projectName": request.metadata.get("project_name", "Untitled"),
                    "projectType": request.metadata.get("project_type", "application"),
                    "stack": request.metadata.get("stack", "full-stack"),
                    "generationMode": request.metadata.get("generation_mode", "fast")
                },
                headers=headers
            )
            
            response.raise_for_status()
            return response.json()
    
    async def _call_tavily(
        self,
        request: ClientRequest,
        model: AIModel
    ) -> Dict[str, Any]:
        """Call Tavily search API"""
        import httpx
        
        async with httpx.AsyncClient(timeout=model.timeout) as client:
            response = await client.post(
                f"{model.endpoint}/search",
                json={
                    "api_key": model.api_key,
                    "query": request.prompt,
                    "search_depth": request.metadata.get("search_depth", "advanced"),
                    "max_results": request.metadata.get("max_results", 10),
                    "include_answer": request.metadata.get("include_answer", False),
                    "include_raw_content": request.metadata.get("include_raw_content", True)
                }
            )
            
            response.raise_for_status()
            return response.json()
    
    async def _call_generic_model(
        self,
        request: ClientRequest,
        model: AIModel
    ) -> Dict[str, Any]:
        """Call a generic AI model API"""
        import httpx
        
        # For OpenAI-compatible endpoints
        async with httpx.AsyncClient(timeout=model.timeout) as client:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {model.api_key}"
            }
            
            response = await client.post(
                f"{model.endpoint}/chat/completions",
                json={
                    "model": model.name,
                    "messages": [
                        {
                            "role": "user",
                            "content": request.prompt
                        }
                    ],
                    "max_tokens": model.max_tokens,
                    "temperature": model.temperature
                },
                headers=headers
            )
            
            response.raise_for_status()
            data = response.json()
            
            # Extract and return the response
            if "choices" in data and len(data["choices"]) > 0:
                return {
                    "response": data["choices"][0]["message"]["content"],
                    "usage": data.get("usage", {}),
                    "model": model.name
                }
            
            return data
    
    def get_request_status(self, request_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a request"""
        request = self.active_requests.get(request_id)
        if not request:
            return None
        
        return {
            "request_id": request.request_id,
            "status": "processing" if request.request_id in self.active_requests else "unknown",
            "timestamp": request.timestamp.isoformat(),
            "priority": request.priority
        }
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get handler metrics"""
        return {
            **self.metrics,
            "active_requests": len(self.active_requests),
            "queue_size": self.request_queue.qsize(),
            "available_models": len(self.get_available_models()),
            "total_models": len(self.models)
        }
    
    def get_client_history(self, client_id: str, limit: int = 100) -> List[Dict]:
        """Get request history for a client"""
        return self.client_history.get(client_id, [])[-limit:]
    
    def reset_metrics(self):
        """Reset all metrics"""
        self.metrics = {
            "total_requests": 0,
            "completed_requests": 0,
            "failed_requests": 0,
            "average_response_time": 0.0,
            "last_request_time": None,
        }


# Singleton instance
client_handler = AIClientHandler()


class AIOfflineHandler:
    """
    Handles AI service offline scenarios with fallback strategies.
    """
    
    def __init__(self, client_handler: AIClientHandler):
        self.client_handler = client_handler
        self.offline_mode = False
        self.fallback_strategies = {
            "search": self._fallback_search,
            "generate": self._fallback_generate,
            "score": self._fallback_score,
            "edit": self._fallback_edit,
        }
    
    def check_ai_online(self) -> bool:
        """Check if AI service is online"""
        available_models = self.client_handler.get_available_models()
        return len(available_models) > 0
    
    def set_offline_mode(self, offline: bool):
        """Set offline mode"""
        self.offline_mode = offline
        print(f"AI service offline mode: {offline}")
    
    async def execute_with_fallback(
        self,
        task_type: str,
        *args,
        **kwargs
    ) -> Any:
        """Execute a task with automatic fallback if AI is offline"""
        if self.offline_mode or not self.check_ai_online():
            print(f"AI service offline, using fallback for {task_type}")
            fallback = self.fallback_strategies.get(task_type)
            if fallback:
                return await fallback(*args, **kwargs)
            raise RuntimeError(f"No fallback available for {task_type}")
        
        # AI is online, execute normally
        return await self._execute_task(task_type, *args, **kwargs)
    
    async def _execute_task(self, task_type: str, *args, **kwargs):
        """Execute the actual AI task"""
        if task_type == "search":
            return await self._ai_search(*args, **kwargs)
        elif task_type == "generate":
            return await self._ai_generate(*args, **kwargs)
        elif task_type == "score":
            return await self._ai_score(*args, **kwargs)
        elif task_type == "edit":
            return await self._ai_edit(*args, **kwargs)
        else:
            raise ValueError(f"Unknown task type: {task_type}")
    
    async def _ai_search(self, query: str, **kwargs):
        """Execute AI search"""
        request = ClientRequest(
            request_id=f"search_{datetime.now().timestamp()}",
            prompt=query,
            metadata={"search_depth": kwargs.get("search_depth", "advanced")}
        )
        result = await self.client_handler.process_request(request)
        return result
    
    async def _ai_generate(self, prompt: str, **kwargs):
        """Execute AI generation"""
        request = ClientRequest(
            request_id=f"gen_{datetime.now().timestamp()}",
            prompt=prompt,
            metadata={
                "project_name": kwargs.get("project_name", "Untitled"),
                "project_type": kwargs.get("project_type", "application"),
                "stack": kwargs.get("stack", "full-stack")
            }
        )
        result = await self.client_handler.process_request(request)
        return result
    
    async def _ai_score(self, lead: Dict, **kwargs):
        """Score a lead using AI"""
        # This would call the actual AI scoring endpoint
        import httpx
        
        ai_url = os.getenv("HEXAWAVE_AI_URL", "http://127.0.0.1:8000")
        token = os.getenv("HEXAWAVE_AI_SERVICE_TOKEN", "")
        
        async with httpx.AsyncClient(timeout=30) as client:
            headers = {"Content-Type": "application/json"}
            if token:
                headers["X-Hexawave-Service-Token"] = token
            
            response = await client.post(
                f"{ai_url}/lead/score",
                json={"lead": lead},
                headers=headers
            )
            
            response.raise_for_status()
            return response.json()
    
    async def _ai_edit(self, file_path: str, content: str, instruction: str):
        """Edit code using AI"""
        import httpx
        
        ai_url = os.getenv("HEXAWAVE_AI_URL", "http://127.0.0.1:8000")
        token = os.getenv("HEXAWAVE_AI_SERVICE_TOKEN", "")
        
        async with httpx.AsyncClient(timeout=60) as client:
            headers = {"Content-Type": "application/json"}
            if token:
                headers["X-Hexawave-Service-Token"] = token
            
            response = await client.post(
                f"{ai_url}/projects/test/ai-edit",
                json={
                    "filePath": file_path,
                    "instruction": instruction
                },
                headers=headers
            )
            
            response.raise_for_status()
            return response.json()
    
    # Fallback strategies
    async def _fallback_search(self, query: str, **kwargs) -> Dict:
        """Fallback search when AI is offline"""
        print("Using fallback search (offline mode)")
        
        # Return mock results based on query
        return {
            "results": [
                {
                    "title": f"Example {query}",
                    "url": f"https://example.com/{query.replace(' ', '-')}",
                    "content": f"This is a fallback result for: {query}",
                    "score": 0.8
                }
            ],
            "answer": f"Fallback result for: {query}",
            "fallback": True
        }
    
    async def _fallback_generate(self, prompt: str, **kwargs) -> Dict:
        """Fallback generation when AI is offline"""
        print("Using fallback generation (offline mode)")
        
        # Return a template project
        project_name = kwargs.get("project_name", "My Project")
        project_type = kwargs.get("project_type", "application")
        
        return {
            "success": True,
            "projectId": f"fallback-{datetime.now().timestamp()}",
            "files": [
                {
                    "name": "main.py",
                    "language": "python",
                    "content": f"""# {project_name}
# Generated in offline mode
# Project Type: {project_type}

def main():
    print("Hello from {project_name}!")
    # TODO: Implement your application logic here

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
"""
                }
            ],
            "fallback": True,
            "message": "Generated in offline mode - AI service unavailable"
        }
    
    async def _fallback_score(self, lead: Dict, **kwargs) -> Dict:
        """Fallback lead scoring when AI is offline"""
        print("Using fallback lead scoring (offline mode)")
        
        # Simple heuristic-based scoring
        score = 0
        reasons = []
        
        if lead.get("companyName"):
            score += 10
            reasons.append("+10: Company name is present")
        
        if lead.get("email"):
            score += 20
            reasons.append("+20: Contact email is available")
        
        if lead.get("website"):
            score += 15
            reasons.append("+15: Company website is available")
        
        if lead.get("industry"):
            score += 5
            reasons.append("+5: Industry information is available")
        
        qualification = "HIGH_PRIORITY" if score >= 80 else "GOOD" if score >= 60 else "MEDIUM" if score >= 35 else "LOW"
        
        return {
            "score": min(score, 100),
            "reasons": reasons,
            "qualification": qualification,
            "fallback": True
        }
    
    async def _fallback_edit(self, file_path: str, content: str, instruction: str) -> Dict:
        """Fallback code editing when AI is offline"""
        print("Using fallback code editing (offline mode)")
        
        # Simple text-based editing
        if "add" in instruction.lower() and "function" in instruction.lower():
            # Add a new function
            new_function = f"""
def new_function():
    # TODO: Implement this function
    # Instruction: {instruction}
    pass
"""
            return {
                "success": True,
                "path": file_path,
                "content": content + new_function,
                "fallback": True,
                "message": "Added new function stub (offline mode)"
            }
        
        elif "fix" in instruction.lower() or "error" in instruction.lower():
            # Add error handling
            fixed_content = content.replace(
                "def ",
                "def \n    try:"
            )
            return {
                "success": True,
                "path": file_path,
                "content": fixed_content,
                "fallback": True,
                "message": "Added basic error handling (offline mode)"
            }
        
        else:
            # Just append comment with instruction
            return {
                "success": True,
                "path": file_path,
                "content": content + f"\n\n# TODO: {instruction}\n",
                "fallback": True,
                "message": "Added comment with instruction (offline mode)"
            }


# Global offline handler instance
_ai_client_handler = AIClientHandler()
offline_handler = AIOfflineHandler(_ai_client_handler)
