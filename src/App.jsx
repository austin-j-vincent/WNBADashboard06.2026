import './App.css'
import TodaysGames from './components/TodaysGames'
import Standings from './components/Standings'
import ThemeToggle from './components/ThemeToggle'
import RefreshButton from './components/RefreshButton'
import RefreshOverlay from './components/RefreshOverlay'
import { RefreshProvider } from './contexts/RefreshContext'

function App() {
  return (
    <RefreshProvider>
      <div className="app">
        <header className="app-header">
          <h1>WNBA</h1>
          <p>Live Season Dashboard</p>
          <RefreshButton />
          <ThemeToggle />
        </header>
        <main className="app-content">
          <TodaysGames />
          <Standings />
        </main>
      </div>
      <RefreshOverlay />
    </RefreshProvider>
  )
}

export default App
