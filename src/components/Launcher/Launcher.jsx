import { useHistory } from 'react-router-dom';
import './Launcher.css';

const Launcher = () => {
  const history = useHistory();

  const launchApp = (app) => {
    history.push(`/${app}`);
  };

  return (
    <div className="launcher">
      <h2>Application Launcher</h2>
      <button type="button" onClick={() => launchApp('math-app')}>
        Launch Math App
      </button>
      <button type="button" onClick={() => launchApp('english-app')}>
        Launch English App
      </button>
      <button type="button" onClick={() => window.open('/tools/wow-lite.html', '_blank')}>
        Launch WoW-Lite
      </button>
    </div>
  );
};

export default Launcher;
