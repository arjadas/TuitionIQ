import './App.css'

function App() {

  return (
    <>

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          background: "#f59e0b",
          color: "white",
          padding: "0.5rem",
          textAlign: "center",
          fontWeight: "bold",
        }}
      >
        🚧 TuitionIQ is currently under development 🚧
      </div>


      <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#eff6ff",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "3rem",
          borderRadius: "16px",
          boxShadow: "0 4px 30px rgba(0,0,0,0.1)",
          maxWidth: "600px",
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: "2.5rem",
            marginBottom: "1rem",
            color: "#1e3a8a",
          }}
        >
          TuitionIQ
        </h1>

        <p
          style={{
            color: "#475569",
            marginBottom: "2rem",
            lineHeight: "1.5",
          }}
        >
          Welcome to TuitionIQ! <br />
          Your all-in-one student management platform. <br /> <br />
          Manage students, track payments, and organize your tuition operations seamlessly from a single dashboard.
        </p>

        <button
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            fontSize: "1rem",
            cursor: "pointer",
          }}
          onClick={() => alert("Stay tuned for updates!")}
        >
          Get Started
        </button>
      </div>

      <footer style={{ marginTop: "2rem", color: "#64748b" }}>
        © {new Date().getFullYear()} TuitionIQ
      </footer>
    </div>

    </>
  );
}

export default App
