import { useBrainConnection } from '../../brain/BrainConnection.jsx';
import { Link } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const { status } = useBrainConnection();

  return (
    <header className="header">
      <h1 className="header-title">World Engine IDE</h1>
      <div className={`brain-status brain-status--${status}`}>Brain: {status}</div>
      <nav className="header-nav">
        <ul>
          <li>
            <Link to="/dashboard">Dashboard</Link>
          </li>
          <li>
            <Link to="/studio">Studio</Link>
          </li>
          <li>
            <Link to="/launcher">Launcher</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;
