import React, { useState } from "react";
import { Upload, BarChart3, Settings, Home } from "lucide-react";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import UploadScreen from "./components/UploadScreen";
import ResultsScreen from "./components/ResultsScreen";
import DashboardScreen from "./components/DashboardScreen";

function App() {
  const [currentScreen, setCurrentScreen] = useState("dashboard");
  const [currentJobId, setCurrentJobId] = useState(null);

  const navigation = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "upload", label: "Upload", icon: Upload },
    { id: "results", label: "Results", icon: BarChart3 },
  ];

  const renderScreen = () => {
    switch (currentScreen) {
      case "dashboard":
        return <DashboardScreen onNavigate={(screen, jobId) => {
          if (screen === "results" && jobId) {
            setCurrentJobId(jobId);
            setCurrentScreen("results");
          } else {
            setCurrentScreen(screen);
          }
        }} />;
      case "upload":
        return (
          <UploadScreen
            onUploadSuccess={(jobId) => {
              setCurrentJobId(jobId);
              setCurrentScreen("results");
            }}
          />
        );
      case "results":
        return <ResultsScreen jobId={currentJobId} />;
      default:
        return <DashboardScreen onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">
                  Ad Optimize AI
                </h1>
              </div>
              <Badge variant="secondary">v1.0.0</Badge>
            </div>
            {/* <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div> */}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={currentScreen === item.id ? "default" : "ghost"}
                  className="flex items-center space-x-2"
                  onClick={() => setCurrentScreen(item.id)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">{renderScreen()}</main>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>© 2025 Ad Optimize AI. All rights reserved.</div>
            <div className="flex items-center space-x-4">
              <span>Powered by AI</span>
              <span>•</span>
              <span>Built with React & Tailwind</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
