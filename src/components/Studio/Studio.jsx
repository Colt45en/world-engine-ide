import './Studio.css';

const Studio = () => {
  return (
    <div className="studio-container">
      <h1>Welcome to the Studio</h1>
      <p>This is your workspace for interacting with applications.</p>

      <div className="studio-tools">
        <h3>Tools</h3>
        <ul>
          <li>
            <a href="/studio/nexus-dual">NEXUS Dual Sandbox</a>
          </li>
          <li>
            <a href="/studio/wow-lite">WoW-Lite Prototype</a>
          </li>
          <li>
            <a href="/studio/web-dev-guide">Web Dev Guide</a>
          </li>
        </ul>
      </div>

      {/* Additional components and functionality can be added here */}
    </div>
  );
};

export default Studio;
