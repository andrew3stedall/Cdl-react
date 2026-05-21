import { getDefaultThemePreset } from './theme-presets';

export function App() {
  const preset = getDefaultThemePreset();

  return (
    <main>
      <h1>Castle Draft League</h1>
      <p>Modern application foundation is ready.</p>
      <p>Default visual preset: {preset.label}</p>
    </main>
  );
}
