import { TopBar } from './components/TopBar';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { PlansModal } from './components/PlansModal';
import { ShortcutModal } from './components/ShortcutModal';
import { Toast } from './components/Toast';

function App() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-100">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Toolbar />
        <Canvas />
        <PropertiesPanel />
      </div>
      <PlansModal />
      <ShortcutModal />
      <Toast />
    </div>
  );
}

export default App;
