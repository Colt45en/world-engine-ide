import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Dashboard from './components/Dashboard/Dashboard';
import Studio from './components/Studio/Studio';
import Launcher from './components/Launcher/Launcher';
import Header from './components/shared/Header';
import Sidebar from './components/shared/Sidebar';
import { AppProvider } from './core/state';

const App = () => {
    return (
        <AppProvider>
            <Router>
                <div className="app-container">
                    <Header />
                    <Sidebar />
                    <main>
                        <Switch>
                            <Route path="/" exact component={Dashboard} />
                            <Route path="/studio" component={Studio} />
                            <Route path="/launcher" component={Launcher} />
                        </Switch>
                    </main>
                </div>
            </Router>
        </AppProvider>
    );
};

export default App;