/* eslint-disable react/no-deprecated */
import ReactDOM from 'react-dom';

export function createRoot(container) {
  return {
    render(element) {
      ReactDOM.render(element, container);
    },
    unmount() {
      ReactDOM.unmountComponentAtNode(container);
    },
  };
}

export function hydrateRoot(container, element) {
  ReactDOM.hydrate(element, container);
  return createRoot(container);
}
