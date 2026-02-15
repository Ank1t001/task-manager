import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

function App() {
  const {
    loginWithRedirect,
    logout,
    isAuthenticated,
    user,
    isLoading,
    getAccessTokenSilently,
  } = useAuth0();

  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) return;

    loadTasks();
  }, [isAuthenticated]);

  async function loadTasks() {
    try {
      const token = await getAccessTokenSilently();

      const res = await fetch("/api/tasks", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("Failed loading tasks", err);
    }
  }

  async function bootstrapTenant() {
    const token = await getAccessTokenSilently();

    await fetch("/api/tenants/bootstrap", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "My Workspace" }),
    });
  }

  useEffect(() => {
    if (isAuthenticated) {
      bootstrapTenant();
    }
  }, [isAuthenticated]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div style={{ padding: "40px", fontFamily: "Inter, sans-serif" }}>
      <h1>Digital Team Task Tracker</h1>

      {!isAuthenticated ? (
        <button onClick={() => loginWithRedirect()}>
          Login
        </button>
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            Welcome {user?.name}
            <button
              onClick={() =>
                logout({ logoutParams: { returnTo: window.location.origin } })
              }
              style={{ marginLeft: 20 }}
            >
              Logout
            </button>
          </div>

          <h2>Total Tasks: {tasks.length}</h2>
        </>
      )}
    </div>
  );
}

export default App;