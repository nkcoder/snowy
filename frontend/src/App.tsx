import './App.css';

function App() {
    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <div className="w-64 bg-gray-800 text-white p-4">
                <h1 className="text-xl font-bold mb-4">Snowy</h1>
                <nav>
                    <ul>
                        <li className="mb-2">
                            <a href="#" className="block p-2 rounded hover:bg-gray-700">Projects</a>
                        </li>
                        <li className="mb-2">
                            <a href="#" className="block p-2 rounded hover:bg-gray-700">Datasources</a>
                        </li>
                        <li className="mb-2">
                            <a href="#" className="block p-2 rounded hover:bg-gray-700">Query Editor</a>
                        </li>
                    </ul>
                </nav>
            </div>
            {/* Main Content */}
            <div className="flex-1 p-4">
                <h2 className="text-2xl font-bold mb-4">Welcome to Snowy</h2>
                <p>PostgreSQL GUI Client</p>
            </div>
        </div>
    );
}

export default App;
