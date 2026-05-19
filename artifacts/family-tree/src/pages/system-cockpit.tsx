import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetSystemStats, getGetSystemStatsQueryKey, useListAllFamilies, getListAllFamiliesQueryKey, useGetAuditLogs, getGetAuditLogsQueryKey, useCreateFamily } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Activity, Users, Home, Database, Search, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";

export default function SystemCockpit() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [logFilter, setLogFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newFamilyDesc, setNewFamilyDesc] = useState("");

  const { data: stats } = useGetSystemStats({
    query: { queryKey: getGetSystemStatsQueryKey() }
  });

  const { data: families = [] } = useListAllFamilies({
    query: { queryKey: getListAllFamiliesQueryKey() }
  });

  const { data: logs = [] } = useGetAuditLogs({ limit: 100 }, {
    query: { queryKey: getGetAuditLogsQueryKey({ limit: 100 }) }
  });

  const createFamily = useCreateFamily();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "cyber");
    document.documentElement.classList.add("dark");
    
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: getGetSystemStatsQueryKey() });
      qc.invalidateQueries({ queryKey: getListAllFamiliesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetAuditLogsQueryKey({ limit: 100 }) });
    }, 30000);

    return () => {
      clearInterval(interval);
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.classList.remove("dark");
    };
  }, [qc]);

  const handleCreateFamily = () => {
    if (!newFamilyName.trim()) return;
    createFamily.mutate({ data: { name: newFamilyName.trim(), description: newFamilyDesc.trim() || undefined } }, {
      onSuccess: (f: any) => {
        toast({ title: `Family "${f.name}" created`, description: `ID: ${f.id}` });
        qc.invalidateQueries({ queryKey: getListAllFamiliesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetSystemStatsQueryKey() });
        setNewFamilyName("");
        setNewFamilyDesc("");
        setCreateOpen(false);
      },
      onError: () => toast({ title: "Failed to create family", variant: "destructive" })
    });
  };

  const filteredLogs = (logs as any[]).filter((l) => 
    l.action.toLowerCase().includes(logFilter.toLowerCase()) || 
    (l.details && JSON.stringify(l.details).toLowerCase().includes(logFilter.toLowerCase())) ||
    l.userId?.toLowerCase().includes(logFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-mono p-6 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <Link href="/feed" className="p-2 bg-slate-900 rounded border border-slate-800 hover:bg-slate-800 transition-colors text-slate-400">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 uppercase tracking-widest flex items-center gap-3">
                <Activity className="text-emerald-500 w-6 h-6 animate-pulse" />
                System Cockpit
              </h1>
              <p className="text-xs text-slate-500 tracking-wider">Ghost Admin Level Access • Live</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded text-xs uppercase tracking-widest font-bold">
              v1.0.0-stable
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded text-xs uppercase tracking-widest font-bold hover:bg-emerald-500/20 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> New Family
                </button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border border-slate-700 text-slate-100 font-mono">
                <DialogHeader>
                  <DialogTitle className="uppercase tracking-widest text-sm text-emerald-400">Create New Family</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400 uppercase tracking-wider">Family Name *</Label>
                    <Input
                      value={newFamilyName}
                      onChange={e => setNewFamilyName(e.target.value)}
                      placeholder="e.g. The Johnson Family"
                      className="bg-slate-950 border-slate-700 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400 uppercase tracking-wider">Description</Label>
                    <Input
                      value={newFamilyDesc}
                      onChange={e => setNewFamilyDesc(e.target.value)}
                      placeholder="Optional short description"
                      className="bg-slate-950 border-slate-700 text-slate-100"
                    />
                  </div>
                  <Button
                    onClick={handleCreateFamily}
                    disabled={!newFamilyName.trim() || createFamily.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white uppercase tracking-widest text-xs"
                  >
                    {createFamily.isPending ? "Creating…" : "Create Family"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { label: "Total Families", val: stats?.totalFamilies ?? 0, icon: Home },
            { label: "Total Users", val: stats?.totalUsers ?? 0, icon: Users },
            { label: "Active Users", val: stats?.activeUsers ?? 0, icon: Activity, color: "text-emerald-500" },
            { label: "Pending Users", val: stats?.pendingUsers ?? 0, icon: Users, color: "text-amber-500" },
            { label: "Total Posts", val: stats?.totalPosts ?? 0, icon: Database },
            { label: "Total Media", val: stats?.totalMedia ?? 0, icon: Database },
          ].map((s, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-lg relative overflow-hidden">
              <s.icon className={`absolute -bottom-2 -right-2 w-16 h-16 opacity-5 ${s.color || 'text-slate-100'}`} />
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">{s.label}</div>
              <div className={`text-3xl font-light ${s.color || 'text-slate-100'}`}>{s.val}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Families Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h2 className="uppercase tracking-widest text-sm font-semibold text-slate-100">Registered Families</h2>
              <div className="text-xs text-slate-500">{families.length} records</div>
            </div>
            <div className="overflow-auto flex-1 p-0">
              <Table>
                <TableHeader className="bg-slate-900 sticky top-0">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-500 uppercase text-xs">ID</TableHead>
                    <TableHead className="text-slate-500 uppercase text-xs">Name</TableHead>
                    <TableHead className="text-slate-500 uppercase text-xs">Members</TableHead>
                    <TableHead className="text-slate-500 uppercase text-xs">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {families.map((f: any) => (
                    <TableRow key={f.id} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell className="font-mono text-xs text-slate-600">{f.id.substring(0,8)}</TableCell>
                      <TableCell className="font-medium text-slate-300">{f.name}</TableCell>
                      <TableCell>{f.memberCount}</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDistanceToNow(new Date(f.createdAt))} ago</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 gap-4">
              <h2 className="uppercase tracking-widest text-sm font-semibold text-slate-100 whitespace-nowrap">Audit Logs</h2>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  value={logFilter} 
                  onChange={e => setLogFilter(e.target.value)} 
                  placeholder="Filter logs..." 
                  className="bg-slate-950 border-slate-700 h-8 pl-8 text-xs font-mono rounded"
                />
              </div>
            </div>
            <div className="overflow-auto flex-1 p-0">
              <Table>
                <TableHeader className="bg-slate-900 sticky top-0">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-500 uppercase text-xs w-[140px]">Time</TableHead>
                    <TableHead className="text-slate-500 uppercase text-xs">Action</TableHead>
                    <TableHead className="text-slate-500 uppercase text-xs">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((l: any) => (
                    <TableRow key={l.id} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(l.timestamp ?? l.createdAt), 'HH:mm:ss.SSS')}</TableCell>
                      <TableCell className="font-mono text-xs text-emerald-400">{l.action}</TableCell>
                      <TableCell className="font-mono text-[10px] text-slate-500 break-all">
                        <span className="text-slate-400 mr-2">[{l.userId?.substring(0,6)}]</span>
                        {JSON.stringify(l.details)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLogs.length === 0 && (
                    <TableRow className="border-transparent hover:bg-transparent">
                      <TableCell colSpan={3} className="text-center text-slate-600 py-12">No logs found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}