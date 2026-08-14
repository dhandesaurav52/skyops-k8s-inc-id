import React, { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { ConnectClusterModal } from './components/ConnectClusterModal';
import { IncidentDetailModal } from './components/IncidentDetailModal';
import { TicketDetailModal } from './components/TicketDetailModal';

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
  simulateIncident as simulateIncidentApi,
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [events, setEvents] = useState<K8sEvent[]>([]);
  const [nodes, setNodes] = useState<NodeHealth[]>([]);
  const [workloads, setWorkloads] = useState<WorkloadHealth[]>([]);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [apiHealthy, setApiHealthy] = useState<boolean>(true);

  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
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
      setApiHealthy(true);

      // ONLY update currently open incident or ticket if still open (prevents reopening after close)
      setSelectedIncident((curr) => {
        if (!curr) return null;
        return incidentsData.find((i: Incident) => i.id === curr.id) || curr;
      });

      setSelectedTicket((curr) => {
        if (!curr) return null;
        return ticketsData.find((t: Ticket) => t.id === curr.id) || curr;
      });
    } catch (err) {
      console.error('Error fetching telemetry data:', err);
      setApiHealthy(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll telemetry every 8 seconds for live updates
    const interval = setInterval(loadData, 8000);
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

  const handleSimulateIncident = async () => {
    try {
      const newInc = await simulateIncidentApi();
      await loadData();
      setSelectedIncident(newInc);
    } catch (err) {
      console.error('Failed to inject incident signal', err);
    }
  };

  const handleOpenLinkedIncident = (incidentId: string) => {
    const inc = incidents.find((i) => i.id === incidentId);
    if (inc) {
      setSelectedTicket(null);
      setSelectedIncident(inc);
    }
  };

  const handleOpenLinkedTicket = (ticketId: string) => {
    const tick = tickets.find((t) => t.id === ticketId);
    if (tick) {
      setSelectedIncident(null);
      setSelectedTicket(tick);
    }
  };

  // Filter items based on selected cluster
  const clusterFilteredIncidents = selectedClusterId
    ? incidents.filter((i) => i.cluster_id === selectedClusterId)
    : incidents;

  const clusterFilteredTickets = selectedClusterId
    ? tickets.filter((t) => t.cluster_id === selectedClusterId)
    : tickets;

  const activeIncidentsCount = clusterFilteredIncidents.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  ).length;

  const openTicketsCount = clusterFilteredTickets.filter(
    (t) => t.status !== 'CLOSED' && t.status !== 'RESOLVED'
  ).length;

  // Filtered lists if search query is active
  const filteredIncidents = searchQuery
    ? clusterFilteredIncidents.filter(
        (i) =>
          i.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.cluster_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.namespace.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : clusterFilteredIncidents;

  const filteredTickets = searchQuery
    ? clusterFilteredTickets.filter(
        (t) =>
          t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.cluster_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : clusterFilteredTickets;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewPage
            clusters={clusters}
            incidents={filteredIncidents}
            tickets={filteredTickets}
            events={events}
            nodes={nodes}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            onSelectTicket={(tick) => setSelectedTicket(tick)}
            onNavigateTab={setActiveTab}
            demoMode={demoMode}
            onToggleDemoMode={handleToggleDemoMode}
            onSimulateIncident={handleSimulateIncident}
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
        return (
          <TicketsPage
            tickets={filteredTickets}
            onRefresh={loadData}
            onSelectTicket={(ticket) => setSelectedTicket(ticket)}
          />
        );
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
            events={events}
            nodes={nodes}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            onSelectTicket={(tick) => setSelectedTicket(tick)}
            onNavigateTab={setActiveTab}
            demoMode={demoMode}
            onToggleDemoMode={handleToggleDemoMode}
            onSimulateIncident={handleSimulateIncident}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#070a0f] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <Header
        demoMode={demoMode}
        onToggleDemoMode={handleToggleDemoMode}
        clusters={clusters}
        selectedClusterId={selectedClusterId}
        onSelectCluster={setSelectedClusterId}
        activeIncidentsCount={activeIncidentsCount}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onSimulateIncident={handleSimulateIncident}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={loadData}
        onOpenSettings={() => setActiveTab('settings')}
        apiHealthy={apiHealthy}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          activeIncidentsCount={activeIncidentsCount}
          openTicketsCount={openTicketsCount}
          clustersCount={clusters.length}
          apiHealthy={apiHealthy}
        />

        <main className="flex-1 overflow-y-auto bg-[#070a0f] min-h-[calc(100vh-53px)]">
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
        onOpenTicket={handleOpenLinkedTicket}
      />

      {/* SRE Ticket Document Detail Modal */}
      <TicketDetailModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onTicketUpdated={loadData}
        onSelectIncident={handleOpenLinkedIncident}
      />
    </div>
  );
}

