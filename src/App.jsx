import { useState } from 'react'
import './App.css'

function App() {
  const [activities] = useState([
    { id: 1, name: 'Morning Run', type: 'Run', distance: '5.2 km', time: '28:45', date: '2024-01-15' },
    { id: 2, name: 'Evening Ride', type: 'Ride', distance: '32.1 km', time: '1:15:30', date: '2024-01-14' },
    { id: 3, name: 'Trail Run', type: 'Run', distance: '8.7 km', time: '42:20', date: '2024-01-13' },
    { id: 4, name: 'Long Ride', type: 'Ride', distance: '65.3 km', time: '2:30:15', date: '2024-01-12' },
    { id: 5, name: 'Interval Training', type: 'Run', distance: '6.5 km', time: '31:10', date: '2024-01-11' },
  ])

  return (
    <div className="app">
      <header className="header">
        <h1>Activity Dashboard</h1>
      </header>
      <main className="main-content">
        <div className="table-container">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Type</th>
                <th>Distance</th>
                <th>Time</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr key={activity.id}>
                  <td className="activity-name">{activity.name}</td>
                  <td>
                    <span className={`type-badge type-${activity.type.toLowerCase()}`}>
                      {activity.type}
                    </span>
                  </td>
                  <td>{activity.distance}</td>
                  <td>{activity.time}</td>
                  <td>{activity.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

export default App

