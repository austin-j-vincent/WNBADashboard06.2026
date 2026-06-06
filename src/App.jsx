import './App.css'
import TodaysGames from './components/TodaysGames'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Phoenix Mercury 🔥</h1>
        <p>2026 WNBA Season</p>
      </header>
      <main className="app-content">
        <TodaysGames />
      </main>
    </div>
  )
}

export default App
