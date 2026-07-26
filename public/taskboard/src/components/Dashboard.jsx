import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Dashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [user, setUser] = useState(null);
  
  // Loading & Error states
  const [isTasksLoading, setIsTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");

  // Task creation states
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [showAddForm, setShowAddForm] = useState(false);

  // Gemini AI Copilot states
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotResponse, setCopilotResponse] = useState(null);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState("");

  // Fetch session data & tasks on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      // Redirect to signin if not authorized
      navigate("/signin");
      return;
    }

    setUser(JSON.parse(storedUser));
    fetchTasks(token);
  }, []);

  // Fetch tasks helper
  const fetchTasks = async (token) => {
    setIsTasksLoading(true);
    setTasksError("");
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/tasks`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setTasks(response.data);
    } catch (err) {
      console.error("Fetch Tasks Error:", err);
      setTasksError(
        err.response?.data?.message || 
        "Failed to load tasks from server. Please check your backend connection."
      );
    } finally {
      setIsTasksLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/signin");
  };

  const getTasksByStatus = (status) => {
    return tasks.filter((t) => t.status === status);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/tasks/${taskId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state with the returned updated task
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? response.data : t))
      );
    } catch (err) {
      console.error("Update Task Status Error:", err);
      alert("Failed to update task status on server.");
    }
  };

  const handleAddTask = async (e) => {
    if (e) e.preventDefault();
    if (!newTitle.trim()) return;

    const token = localStorage.getItem("token");
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/tasks`,
        {
          title: newTitle.trim(),
          desc: newDesc.trim() || "No description provided.",
          priority: newPriority,
          status: "todo",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Append newly saved MongoDB task to UI state
      setTasks((prev) => [response.data, ...prev]);
      setNewTitle("");
      setNewDesc("");
      setNewPriority("medium");
      setShowAddForm(false);
    } catch (err) {
      console.error("Add Task Error:", err);
      alert("Failed to save new task to server.");
    }
  };

  const handleDeleteTask = async (taskId) => {
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Filter out deleted task locally
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    } catch (err) {
      console.error("Delete Task Error:", err);
      alert("Failed to delete task from server.");
    }
  };

  // Gemini API integration
  const askGemini = async (promptText) => {
    setIsCopilotLoading(true);
    setCopilotError("");
    setCopilotResponse(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/copilot`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            prompt: promptText
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `API returned status ${response.status}. Please check your API key.`);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("No response content from Gemini.");
      }

      // Try parsing JSON list format
      try {
        const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanText);
        if (Array.isArray(parsed)) {
          setCopilotResponse({ type: "tasks", data: parsed });
        } else {
          setCopilotResponse({ type: "text", data: text });
        }
      } catch (e) {
        setCopilotResponse({ type: "text", data: text });
      }
    } catch (err) {
      console.error(err);
      setCopilotError(err.message || "Failed to query Gemini. Make sure your API key is correct.");
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const handleSuggestTasks = () => {
    const prompt = `You are a project manager. Suggest 3 useful developer tasks for a React web application.
Return the suggestions strictly as a JSON array of objects, with no surrounding text, markdown formatting, or HTML blocks.
Each object must have exactly these keys: "title" (short task name), "desc" (objective explanation), and "priority" ("high" | "medium" | "low").
Example:
[
  {"title": "Setup CI/CD Pipeline", "desc": "Write Github Actions script for deployment.", "priority": "high"},
  {"title": "Compress Static Assets", "desc": "Reduce image sizes in build bundle.", "priority": "low"}
]`;
    askGemini(prompt);
  };

  const handleCustomPrompt = (e) => {
    e.preventDefault();
    if (!copilotInput.trim()) return;

    const prompt = `You are a helpful project manager.
The user asks: "${copilotInput.trim()}"
If they are asking to generate, draft, or list tasks, respond strictly with a JSON array of objects representing those tasks:
[
  {"title": "Task name", "desc": "Task explanation", "priority": "high"|"medium"|"low"}
]
Otherwise, respond with a helpful plain text answer. Keep your text answer concise and professional. Do not add code formatting unless requested.`;
    
    askGemini(prompt);
    setCopilotInput("");
  };

  const addSuggestedTaskToBoard = async (title, desc, priority) => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/tasks`,
        {
          title,
          desc,
          priority,
          status: "todo",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Append newly saved MongoDB task to UI state
      setTasks((prev) => [response.data, ...prev]);
      
      // Mark as added in current UI suggestions
      if (copilotResponse && copilotResponse.type === "tasks") {
        setCopilotResponse({
          ...copilotResponse,
          data: copilotResponse.data.map((t) => 
            t.title === title ? { ...t, added: true } : t
          )
        });
      }
    } catch (err) {
      console.error("Add Suggested Task Error:", err);
      alert("Failed to save suggested task to server.");
    }
  };

  return (
    <div className="dashboard-container" style={{ width: "100%", padding: "24px", boxSizing: "border-box", textAlign: "left" }}>
      {/* Dashboard Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
        <div>
          <h1 style={{ fontSize: "28px", margin: "0 0 4px 0", letterSpacing: "-0.5px" }}>Task Workspace</h1>
          <p style={{ margin: 0, color: "var(--text)", fontSize: "14px" }}>
            Welcome back, {user ? `${user.firstName} ${user.lastName}` : "User"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" className="btn-secondary" onClick={handleSignOut} style={{ fontSize: "14px" }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* API Key Management is handled internally */}

      {/* Main Grid: Left is Kanban, Right is Copilot */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>
        
        {/* LEFT COLUMN: Statistics & Kanban Board */}
        <div>
          {/* Summary stats */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
            <div style={{ flex: 1, background: "var(--code-bg)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--text)", fontWeight: 600 }}>Total Tasks</span>
              <h3 style={{ fontSize: "24px", margin: "4px 0 0 0", color: "var(--text-h)" }}>{tasks.length}</h3>
            </div>
            <div style={{ flex: 1, background: "rgba(170, 59, 255, 0.05)", padding: "16px", borderRadius: "12px", border: "1px solid var(--accent-border)" }}>
              <span style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--accent)", fontWeight: 600 }}>In Progress</span>
              <h3 style={{ fontSize: "24px", margin: "4px 0 0 0", color: "var(--accent)" }}>{getTasksByStatus("progress").length}</h3>
            </div>
            <div style={{ flex: 1, background: "rgba(16, 185, 129, 0.05)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
              <span style={{ fontSize: "12px", textTransform: "uppercase", color: "#10b981", fontWeight: 600 }}>Completed</span>
              <h3 style={{ fontSize: "24px", margin: "4px 0 0 0", color: "#10b981" }}>{getTasksByStatus("done").length}</h3>
            </div>
          </div>

          {/* Toggle Add Task Form */}
          <div style={{ marginBottom: "24px" }}>
            {!showAddForm ? (
              <button 
                type="button" 
                className="btn-primary" 
                style={{ width: "auto", display: "inline-flex", gap: "8px", padding: "10px 20px", fontSize: "14px", borderRadius: "8px" }}
                onClick={() => setShowAddForm(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add New Task
              </button>
            ) : (
              <form onSubmit={handleAddTask} style={{ background: "var(--code-bg)", padding: "24px", borderRadius: "16px", border: "1px solid var(--border)", maxWidth: "500px" }}>
                <h3 style={{ fontSize: "18px", margin: "0 0 20px 0", color: "var(--text-h)" }}>Add New Task</h3>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="task-title">Task Title</label>
                  <div className="input-wrapper">
                    <input 
                      type="text" 
                      id="task-title" 
                      placeholder="e.g. Write Playwright tests" 
                      value={newTitle} 
                      onChange={(e) => setNewTitle(e.target.value)}
                      style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-h)" }}
                      required 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="task-desc">Description</label>
                  <div className="input-wrapper">
                    <input 
                      type="text" 
                      id="task-desc" 
                      placeholder="Describe the objective..." 
                      value={newDesc} 
                      onChange={(e) => setNewDesc(e.target.value)} 
                      style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-h)" }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "24px" }}>
                  <label className="form-label" htmlFor="task-priority">Priority</label>
                  <div className="input-wrapper">
                    <select 
                      id="task-priority"
                      value={newPriority} 
                      onChange={(e) => setNewPriority(e.target.value)}
                      style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-h)", cursor: "pointer" }}
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)} style={{ padding: "10px 18px" }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" style={{ width: "auto", padding: "10px 20px" }}>
                    Save Task
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Tasks list load check */}
          {isTasksLoading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text)", background: "var(--code-bg)", borderRadius: "16px", border: "1px solid var(--border)" }}>
              <div style={{ width: "30px", height: "30px", border: "3px solid var(--accent-bg)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }}></div>
              <span>Fetching tasks from database...</span>
            </div>
          ) : tasksError ? (
            <div style={{ color: "#f43f5e", padding: "16px", background: "rgba(244,63,94,0.05)", borderRadius: "16px", border: "1px solid rgba(244,63,94,0.15)" }}>
              <strong>Failed to sync database: </strong> {tasksError}
              <button 
                type="button" 
                className="btn-primary" 
                style={{ width: "auto", marginTop: "12px", padding: "6px 12px", fontSize: "12px" }}
                onClick={() => fetchTasks(localStorage.getItem("token"))}
              >
                Retry Connection
              </button>
            </div>
          ) : (
            /* Kanban Board Grid */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
              {/* Todo Column */}
              <div style={{ background: "var(--code-bg)", borderRadius: "16px", padding: "12px", border: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: "15px", margin: "0 0 12px 0", color: "var(--text-h)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>To Do</span>
                  <span style={{ background: "var(--border)", padding: "2px 8px", borderRadius: "20px", fontSize: "11px" }}>
                    {getTasksByStatus("todo").length}
                  </span>
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {getTasksByStatus("todo").map((task) => (
                    <div key={task._id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.01)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                        <h4 style={{ margin: 0, fontSize: "13px", color: "var(--text-h)", fontWeight: "600", paddingRight: "6px" }}>{task.title}</h4>
                        <button 
                          type="button" 
                          onClick={() => handleDeleteTask(task._id)} 
                          title="Delete Task" 
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text)", display: "flex", alignItems: "center" }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "var(--text)", lineHeight: 1.3 }}>{task.desc}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", background: task.priority === "high" ? "rgba(244,63,94,0.1)" : task.priority === "medium" ? "rgba(250,204,21,0.1)" : "rgba(107,99,117,0.1)", color: task.priority === "high" ? "#f43f5e" : task.priority === "medium" ? "#d97706" : "var(--text)", fontWeight: 600 }}>
                          {task.priority.toUpperCase()}
                        </span>
                        <button type="button" onClick={() => handleStatusChange(task._id, "progress")} style={{ width: "auto", padding: "3px 6px", fontSize: "10px", borderRadius: "4px", background: "var(--accent-bg)", color: "var(--accent)", border: "none", cursor: "pointer" }}>
                          Start →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress Column */}
              <div style={{ background: "var(--code-bg)", borderRadius: "16px", padding: "12px", border: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: "15px", margin: "0 0 12px 0", color: "var(--text-h)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>In Progress</span>
                  <span style={{ background: "var(--border)", padding: "2px 8px", borderRadius: "20px", fontSize: "11px" }}>
                    {getTasksByStatus("progress").length}
                  </span>
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {getTasksByStatus("progress").map((task) => (
                    <div key={task._id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.01)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                        <h4 style={{ margin: 0, fontSize: "13px", color: "var(--text-h)", fontWeight: "600", paddingRight: "6px" }}>{task.title}</h4>
                        <button 
                          type="button" 
                          onClick={() => handleDeleteTask(task._id)} 
                          title="Delete Task" 
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text)", display: "flex", alignItems: "center" }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "var(--text)", lineHeight: 1.3 }}>{task.desc}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", background: task.priority === "high" ? "rgba(244,63,94,0.1)" : task.priority === "medium" ? "rgba(250,204,21,0.1)" : "rgba(107,99,117,0.1)", color: task.priority === "high" ? "#f43f5e" : task.priority === "medium" ? "#d97706" : "var(--text)", fontWeight: 600 }}>
                          {task.priority.toUpperCase()}
                        </span>
                        <button type="button" onClick={() => handleStatusChange(task._id, "done")} style={{ width: "auto", padding: "3px 6px", fontSize: "10px", borderRadius: "4px", background: "rgba(16,185,129,0.1)", color: "#10b981", border: "none", cursor: "pointer" }}>
                          Complete ✓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Done Column */}
              <div style={{ background: "var(--code-bg)", borderRadius: "16px", padding: "12px", border: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: "15px", margin: "0 0 12px 0", color: "var(--text-h)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Done</span>
                  <span style={{ background: "var(--border)", padding: "2px 8px", borderRadius: "20px", fontSize: "11px" }}>
                    {getTasksByStatus("done").length}
                  </span>
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {getTasksByStatus("done").map((task) => (
                    <div key={task._id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", opacity: 0.85, boxShadow: "0 2px 4px rgba(0,0,0,0.01)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                        <h4 style={{ margin: 0, fontSize: "13px", color: "var(--text-h)", fontWeight: "600", textDecoration: "line-through", paddingRight: "6px" }}>{task.title}</h4>
                        <button 
                          type="button" 
                          onClick={() => handleDeleteTask(task._id)} 
                          title="Delete Task" 
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text)", display: "flex", alignItems: "center" }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "var(--text)", lineHeight: 1.3 }}>{task.desc}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", background: "rgba(16,185,129,0.1)", color: "#10b981", fontWeight: 600 }}>
                          DONE
                        </span>
                        <button type="button" onClick={() => handleStatusChange(task._id, "todo")} style={{ width: "auto", padding: "3px 6px", fontSize: "10px", borderRadius: "4px", background: "var(--code-bg)", color: "var(--text-h)", border: "1px solid var(--border)", cursor: "pointer" }}>
                          Re-open ↺
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: AI Copilot Sidebar */}
        <div style={{ background: "var(--code-bg)", borderRadius: "20px", border: "1px solid var(--border)", padding: "20px", display: "flex", flexDirection: "column", gap: "20px", height: "fit-content" }}>
          <div>
            <h3 style={{ fontSize: "16px", margin: "0 0 4px 0", color: "var(--text-h)", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--accent)" }}>
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
              Gemini AI Copilot
            </h3>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--text)" }}>Generate task ideas or ask project advice.</p>
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handleSuggestTasks}
              disabled={isCopilotLoading}
              style={{ fontSize: "13px", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            >
              Suggest Developer Tasks
            </button>
          </div>

          {/* Chat and Loading States */}
          <div style={{ minHeight: "120px", maxHeight: "300px", overflowY: "auto", padding: "12px", borderRadius: "10px", background: "var(--bg)", border: "1px solid var(--border)" }}>
            {isCopilotLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", justifyContent: "center", height: "100px", color: "var(--text)" }}>
                <div style={{ width: "24px", height: "24px", border: "3px solid var(--accent-bg)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
                <span style={{ fontSize: "12px" }}>Gemini is thinking...</span>
              </div>
            )}

            {copilotError && (
              <div style={{ color: "#f43f5e", fontSize: "12px", padding: "8px", background: "rgba(244,63,94,0.05)", borderRadius: "6px", border: "1px solid rgba(244,63,94,0.15)" }}>
                <strong>Error: </strong>{copilotError}
              </div>
            )}

            {!isCopilotLoading && !copilotError && !copilotResponse && (
              <p style={{ margin: 0, color: "var(--text)", fontSize: "12px", textAlign: "center", paddingTop: "40px" }}>
                No active responses. Use a button above or type below to ask Gemini!
              </p>
            )}

            {copilotResponse && copilotResponse.type === "text" && (
              <div style={{ fontSize: "13px", color: "var(--text-h)", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                {copilotResponse.data}
              </div>
            )}

            {copilotResponse && copilotResponse.type === "tasks" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--accent)" }}>AI SUGGESTIONS:</span>
                {copilotResponse.data.map((item, idx) => (
                  <div key={idx} style={{ padding: "10px", borderRadius: "8px", background: "var(--code-bg)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "12px", color: "var(--text-h)" }}>{item.title}</strong>
                      <span style={{ fontSize: "8px", padding: "1px 4px", borderRadius: "2px", background: "var(--border)", color: "var(--text)", fontWeight: 600 }}>
                        {item.priority?.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "var(--text)", lineHeight: 1.3 }}>{item.desc}</p>
                    {item.added ? (
                      <span style={{ fontSize: "11px", color: "#10b981", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                        ✓ Added to Board
                      </span>
                    ) : (
                      <button 
                        type="button" 
                        className="btn-primary" 
                        onClick={() => addSuggestedTaskToBoard(item.title, item.desc, item.priority)}
                        style={{ padding: "4px 8px", fontSize: "10px", borderRadius: "4px", width: "auto" }}
                      >
                        + Add to Board
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prompt Form */}
          <form onSubmit={handleCustomPrompt} style={{ display: "flex", gap: "8px" }}>
            <input 
              type="text" 
              value={copilotInput} 
              onChange={(e) => setCopilotInput(e.target.value)}
              placeholder="Ask Gemini to draft a task..." 
              style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-h)", fontSize: "13px" }}
              disabled={isCopilotLoading}
            />
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isCopilotLoading || !copilotInput.trim()}
              style={{ width: "auto", padding: "8px 14px", borderRadius: "8px" }}
            >
              Ask
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

export default Dashboard;
