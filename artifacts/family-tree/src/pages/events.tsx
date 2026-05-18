import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListEvents,
  getListEventsQueryKey,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useRsvpEvent,
  useListMembers,
  getListMembersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, MapPin, Users, Plus, Cake } from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";

export default function Events() {
  const { familyId, user, isGatekeeper } = useAuth();
  const [view, setView] = useState("list");
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const { data: eventsList, isLoading } = useListEvents(familyId ?? "", {
    query: { enabled: !!familyId, queryKey: getListEventsQueryKey(familyId ?? "") }
  });
  
  const { data: membersList } = useListMembers(familyId ?? "", {
    query: { enabled: !!familyId, queryKey: getListMembersQueryKey(familyId ?? "") }
  });
  
  const rsvpEvent = useRsvpEvent();
  const createEvent = useCreateEvent();
  
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const events = (eventsList as any)?.items || eventsList || [];
  const members = (membersList as any)?.items || membersList || [];
  
  const handleRsvp = (eventId: string, status: string) => {
    rsvpEvent.mutate({ familyId: familyId ?? "", eventId, data: { status: status as any } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListEventsQueryKey(familyId ?? "") });
        toast({ title: "RSVP updated" });
      }
    });
  };
  
  const handleCreate = () => {
    if (!title || !startDate) return;
    createEvent.mutate({
      familyId: familyId ?? "",
      data: {
        title,
        description,
        location,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      } as any
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListEventsQueryKey(familyId ?? "") });
        toast({ title: "Event created" });
        setCreateOpen(false);
      }
    });
  };
  
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Family Events</h1>
        {isGatekeeper && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Create Event</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input placeholder="Event Title" value={title} onChange={e => setTitle(e.target.value)} />
                <Textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
                <Input placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Start Date/Time</label>
                    <Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">End Date/Time (Optional)</label>
                    <Input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={!title || !startDate || createEvent.isPending}>
                  Create Event
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      <Tabs value={view} onValueChange={setView} className="mb-6">
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="month">Month View</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-medium mb-2">No events coming up</h2>
          <p className="text-muted-foreground">Check back later or create a new event.</p>
        </div>
      ) : (
        <>
          {view === "list" && (
            <div className="space-y-4">
              {events.map((event: any) => {
                const myRsvp = event.rsvps?.find((r: any) => r.userId === user?.id)?.status || "none";
                return (
                  <div key={event.id} className="bg-card border border-border rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
                      <div className="space-y-2 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          <span>{format(new Date(event.startDate), "EEEE, MMMM d, yyyy 'at' h:mm a")}</span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>{event.rsvpCounts?.going || 0} Going &bull; {event.rsvpCounts?.maybe || 0} Maybe</span>
                        </div>
                      </div>
                      <p className="text-foreground">{event.description}</p>
                    </div>
                    
                    <div className="w-full md:w-48 flex-shrink-0 bg-muted rounded-lg p-4 text-center">
                      <h4 className="font-medium text-sm mb-3">Your RSVP</h4>
                      <div className="space-y-2">
                        <Button 
                          size="sm" 
                          variant={myRsvp === "going" ? "default" : "outline"} 
                          className="w-full"
                          onClick={() => handleRsvp(event.id, "going")}
                        >
                          Going
                        </Button>
                        <Button 
                          size="sm" 
                          variant={myRsvp === "maybe" ? "secondary" : "outline"} 
                          className="w-full"
                          onClick={() => handleRsvp(event.id, "maybe")}
                        >
                          Maybe
                        </Button>
                        <Button 
                          size="sm" 
                          variant={myRsvp === "not_going" ? "destructive" : "outline"} 
                          className="w-full"
                          onClick={() => handleRsvp(event.id, "not_going")}
                        >
                          Can't make it
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {view === "month" && (
            <div className="bg-card border border-border rounded-xl p-6">
              <Calendar 
                mode="single"
                className="w-full max-w-full"
                modifiers={{
                  hasEvent: events.map((e: any) => new Date(e.startDate))
                }}
                modifiersStyles={{
                  hasEvent: { fontWeight: "bold", textDecoration: "underline", color: "var(--primary)" }
                }}
              />
              <div className="mt-6 pt-6 border-t border-border grid gap-4 md:grid-cols-2">
                 <h3 className="font-medium col-span-full">Upcoming this month</h3>
                 {events.slice(0, 4).map((e: any) => (
                   <div key={e.id} className="flex gap-3 text-sm p-3 rounded-lg border border-border bg-muted/30">
                     <div className="bg-primary text-primary-foreground font-bold rounded-md w-12 h-12 flex flex-col items-center justify-center flex-shrink-0">
                        <span>{format(new Date(e.startDate), "MMM")}</span>
                        <span>{format(new Date(e.startDate), "d")}</span>
                     </div>
                     <div>
                       <div className="font-medium line-clamp-1">{e.title}</div>
                       <div className="text-muted-foreground">{format(new Date(e.startDate), "h:mm a")}</div>
                     </div>
                   </div>
                 ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
