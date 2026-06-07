import './App.css'
import TodaysGames from './components/TodaysGames'
import ThemeToggle from './components/ThemeToggle'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>WNBA</h1>
        <p>Live Season Dashboard</p>
        <ThemeToggle />
      </header>
      <main className="app-content">
        <TodaysGames />
      </main>
    </div>
  )
}

export default App
