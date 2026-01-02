import { Link } from 'react-router-dom';
import { useBrainConnection } from '../../brain/BrainConnection.jsx';
import './Sidebar.css';

const Sidebar = () => {
  useBrainConnection();

  return (
    <div className="sidebar">
      <h2>World Engine IDE</h2>
      <ul>
        <li>
          <Link to="/">Nexus</Link>
        </li>
        <li>
          <Link to="/dashboard">Dashboard</Link>
        </li>
        <li>
          <Link to="/studio">Studio</Link>
        </li>
        <li>
          <Link to="/studio/turtle-stack">Turtle Stack</Link>
        </li>
        <li>
          <Link to="/diagnostic">Diagnostics</Link>
        </li>
        <li>
          <Link to="/game">Game</Link>
        </li>
        <li>
          <Link to="/grid-placement">Grid Placement</Link>
        </li>
        <li>
          <Link to="/launcher">Launcher</Link>
        </li>
        <li>
          <Link to="/neural-core">Neural Core</Link>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
