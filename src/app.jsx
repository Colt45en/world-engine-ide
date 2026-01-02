import { lazy, Suspense, useEffect } from 'react';
import { Route, BrowserRouter as Router, Switch } from 'react-router-dom';
import { BrainConnectionProvider, useBrainConnection } from './brain/BrainConnection.jsx';
import Header from './components/shared/Header.jsx';
import Sidebar from './components/shared/Sidebar.jsx';
import { MathRouterProvider } from './math-router/MathRouter.jsx';
import Nexus from './pages/Nexus.jsx';

const Dashboard = lazy(() => import('./components/Dashboard/Dashboard.jsx'));
const Studio = lazy(() => import('./components/Studio/Studio.jsx'));
const NexusDual = lazy(() => import('./components/Studio/NexusDual.jsx'));
const WowLite = lazy(() => import('./components/Studio/WowLite.jsx'));
const WebDevGuide = lazy(() => import('./components/Studio/WebDevGuide.jsx'));
const Launcher = lazy(() => import('./components/Launcher/Launcher.jsx'));
const NeuralCore = lazy(() => import('./components/NeuralCore/NeuralCore.jsx'));

const DiagnosticPage = lazy(() =>
  import('./pages/DiagnosticPage.jsx').then((m) => ({ default: m.DiagnosticPage })),
);
const GamePage = lazy(() => import('./pages/GamePage.jsx').then((m) => ({ default: m.GamePage })));
const GridPlacementPage = lazy(() =>
  import('./pages/GridPlacementPage.jsx').then((m) => ({ default: m.GridPlacementPage })),
);
const TurtleStackPage = lazy(() =>
  import('./pages/TurtleStackPage.jsx').then((m) => ({ default: m.TurtleStackPage })),
);

function BrainGatedRoute(props) {
  // Brain connectivity is optional for most UI pages; keep routing accessible.
  // Components can consult `useBrainConnection()` if they need to gate behavior.
  return <Route {...props} />;
}

function BrainPrefetch() {
  const { status } = useBrainConnection();

  useEffect(() => {
    if (status !== 'connected') return undefined;

    const preload = () => {
      import('./components/Dashboard/Dashboard.jsx').catch(() => {});
      import('./components/Studio/Studio.jsx').catch(() => {});
      import('./pages/GamePage.jsx').catch(() => {});
    };

    if (typeof globalThis.requestIdleCallback === 'function') {
      const handle = globalThis.requestIdleCallback(preload);
      return () => globalThis.cancelIdleCallback?.(handle);
    }

    const handle = globalThis.setTimeout(preload, 0);
    return () => globalThis.clearTimeout(handle);
  }, [status]);

  return null;
}

const App = () => {
  return (
    <Router>
      <BrainConnectionProvider>
        <MathRouterProvider>
          <BrainPrefetch />
          <div className="app-container">
            <Header />
            <Sidebar />
            <main>
              <Suspense fallback={<div style={{ padding: 12 }}>Loading…</div>}>
                <Switch>
                  <Route path="/" exact component={Nexus} />
                  <BrainGatedRoute path="/diagnostic" exact component={DiagnosticPage} />
                  <BrainGatedRoute path="/math-app" exact component={DiagnosticPage} />
                  <BrainGatedRoute path="/game" exact component={GamePage} />
                  <BrainGatedRoute path="/grid-placement" exact component={GridPlacementPage} />
                  <BrainGatedRoute path="/dashboard" exact component={Dashboard} />
                  <BrainGatedRoute path="/studio" exact component={Studio} />
                  <BrainGatedRoute path="/studio/nexus-dual" component={NexusDual} />
                  <BrainGatedRoute path="/studio/wow-lite" component={WowLite} />
                  <BrainGatedRoute path="/studio/web-dev-guide" component={WebDevGuide} />
                  <BrainGatedRoute path="/studio/turtle-stack" component={TurtleStackPage} />
                  <BrainGatedRoute path="/launcher" component={Launcher} />
                  <BrainGatedRoute path="/neural-core" component={NeuralCore} />
                </Switch>
              </Suspense>
            </main>
          </div>
        </MathRouterProvider>
      </BrainConnectionProvider>
    </Router>
  );
};

export default App;
