import React from 'react';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard">
      <h1>World Engine IDE Dashboard</h1>
      <p>
        Welcome to the World Engine IDE. Here you can launch applications for Mathematics and
        English.
      </p>
      <div className="app-status">
        <h2>Application Status</h2>
        <ul>
          <li>
            Math Application: <span>Running</span>
          </li>
          <li>
            English Application: <span>Running</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
