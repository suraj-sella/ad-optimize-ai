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
  const [hasUploads, setHasUploads] = useState(false);

  const navigation = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "upload", label: "Upload", icon: Upload },
    { id: "results", label: "Results", icon: BarChart3, disabled: !hasUploads },
  ];

  const renderScreen = () => {
    switch (currentScreen) {
      case "dashboard":
        return (
          <DashboardScreen
            onNavigate={(screen, jobId, uploadsCount) => {
              if (typeof uploadsCount === "number")
                setHasUploads(uploadsCount > 0);
              if (screen === "results" && jobId) {
                setCurrentJobId(jobId);
                setCurrentScreen("results");
              } else if (screen === "results" && !hasUploads) {
                // Prevent navigation if no uploads
                return;
              } else {
                setCurrentScreen(screen);
              }
            }}
          />
        );
      case "upload":
        return (
          <UploadScreen
            onUploadSuccess={(jobId) => {
              setCurrentJobId(jobId);
              setCurrentScreen("results");
              setHasUploads(true);
            }}
          />
        );
      case "results":
        return <ResultsScreen jobId={currentJobId} />;
      default:
        return <DashboardScreen onNavigate={setCurrentScreen} />;
    }
  };

  // Render navigation menu
  const renderNavMenu = () => (
    <nav className="border-b bg-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex space-x-1">
          {navigation.map((nav) => (
            <Button
              key={nav.id}
              variant={currentScreen === nav.id ? "default" : "ghost"}
              onClick={() => {
                if (nav.disabled) return;
                if (nav.id === "results" && !hasUploads) return;
                setCurrentScreen(nav.id);
              }}
              disabled={nav.disabled}
              className="flex items-center space-x-2"
            >
              <nav.icon className="h-5 w-5 mr-2" />
              {nav.label}
            </Button>
          ))}
        </div>
      </div>
    </nav>
  );

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

      {renderNavMenu()}

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
