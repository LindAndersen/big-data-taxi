import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/app-layout'
import { DemandExplorer } from './pages/demand-explorer'
import { Overview } from './pages/overview'

export default function App() {
  return <Routes><Route element={<AppLayout />}><Route path="/explorer" element={<DemandExplorer />} /><Route path="/overview" element={<Overview />} /><Route path="*" element={<Navigate to="/explorer" replace />} /></Route></Routes>
}
