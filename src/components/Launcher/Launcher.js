import React from 'react';
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
            <button onClick={() => launchApp('math-app')}>Launch Math App</button>
            <button onClick={() => launchApp('english-app')}>Launch English App</button>
        </div>
    );
};

export default Launcher;