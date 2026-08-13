import React, { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { ConnectClusterModal } from './components/ConnectClusterModal';
import { IncidentDetailModal } from './components/IncidentDetailModal';

import { OverviewPage } from './pages/OverviewPage';
import { ClustersPage } from './pages/ClustersPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { TicketsPage } from './pages/TicketsPage';
import { MetricsPage } from './pages/MetricsPage';
import { EventsPage } from './pages/EventsPage';
import { NodesPage } from './pages/NodesPage';
import { WorkloadsPage } from './pages/WorkloadsPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';

import {
  Cluster,
  Incident,
  Ticket,
  AuditLog,
  K8sEvent,
  NodeHealth,
  WorkloadHealth,
} from './types';

import {
  fetchClusters,
  fetchIncidents,
  fetchTickets,
  fetchAuditLogs,
  fetchEvents,
  fetchNodes,
  fetchWorkloads,
  fetchDemoModeStatus,
  toggleDemoMode as toggleDemoApi,
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [events, setEvents] = useState<K8sEvent[]>([]);
  const [nodes, setNodes] = useState<NodeHealth[]>([]);
  const [workloads, setWorkloads] = useState<WorkloadHealth[]>([]);
  const [demoMode, setDemoMode] = useState<boolean>(false);

  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const [
        clustersData,
        incidentsData,
        ticketsData,
        auditData,
        eventsData,
        nodesData,
        workloadsData,
        demoStatus,
      ] = await Promise.all([
        fetchClusters().catch(() => []),
        fetchIncidents().catch(() => []),
        fetchTickets().catch(() => []),
        fetchAuditLogs().catch(() => []),
        fetchEvents().catch(() => []),
        fetchNodes().catch(() => []),
        fetchWorkloads().catch(() => []),
        fetchDemoModeStatus().catch(() => ({ demoMode: false })),
      ]);

      setClusters(clustersData);
      setIncidents(incidentsData);
      setTickets(ticketsData);
      setAuditLogs(auditData);
      setEvents(eventsData);
      setNodes(nodesData);
      setWorkloads(workloadsData);
      setDemoMode(demoStatus.demoMode);
    } catch (err) {
      console.error('Error fetching telemetry data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll telemetry every 10 seconds for live updates
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleToggleDemoMode = async () => {
    try {
      const res = await toggleDemoApi(!demoMode);
      setDemoMode(res.demoMode);
      await loadData();
    } catch (err) {
      console.error('Failed to toggle demo mode', err);
    }
  };

  const activeIncidentsCount = incidents.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  ).length;

  const openTicketsCount = tickets.filter(
    (t) => t.status !== 'CLOSED' && t.status !== 'RESOLVED'
  ).length;

  // Filtered lists if search query is active
  const filteredIncidents = searchQuery
    ? incidents.filter(
        (i) =>
          i.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.cluster_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.namespace.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : incidents;

  const filteredTickets = searchQuery
    ? tickets.filter(
        (t) =>
          t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.cluster_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tickets;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewPage
            clusters={clusters}
            incidents={filteredIncidents}
            tickets={filteredTickets}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            demoMode={demoMode}
            onToggleDemoMode={handleToggleDemoMode}
          />
        );
      case 'clusters':
        return (
          <ClustersPage
            clusters={clusters}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onRefresh={loadData}
          />
        );
      case 'incidents':
        return (
          <IncidentsPage
            incidents={filteredIncidents}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
          />
        );
      case 'tickets':
        return <TicketsPage tickets={filteredTickets} onRefresh={loadData} />;
      case 'metrics':
        return <MetricsPage />;
      case 'events':
        return <EventsPage events={events} />;
      case 'nodes':
        return <NodesPage nodes={nodes} />;
      case 'workloads':
        return <WorkloadsPage workloads={workloads} />;
      case 'audit':
        return <AuditPage logs={auditLogs} />;
      case 'settings':
        return (
          <SettingsPage
            demoMode={demoMode}
            onToggleDemoMode={handleToggleDemoMode}
          />
        );
      default:
        return (
          <OverviewPage
            clusters={clusters}
            incidents={filteredIncidents}
            tickets={filteredTickets}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            demoMode={demoMode}
            onToggleDemoMode={handleToggleDemoMode}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <Header
        demoMode={demoMode}
        onToggleDemoMode={handleToggleDemoMode}
        clusterCount={clusters.length}
        activeIncidentsCount={activeIncidentsCount}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          activeIncidentsCount={activeIncidentsCount}
          openTicketsCount={openTicketsCount}
          clustersCount={clusters.length}
        />

        <main className="flex-1 overflow-y-auto bg-slate-950 min-h-[calc(100vh-57px)]">
          {renderTabContent()}
        </main>
      </div>

      {/* Connect Cluster Helm Modal */}
      <ConnectClusterModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onClusterConnected={loadData}
      />

      {/* Correlated Incident Detail Modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onIncidentUpdated={loadData}
      />
    </div>
  );
}
