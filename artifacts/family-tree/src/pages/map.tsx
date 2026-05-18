import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useListMapPins, getListMapPinsQueryKey, useCreateMapPin, useDeleteMapPin, useListMembers, getListMembersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Plus, Trash2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function MapPage() {
  const { familyId, isGatekeeper } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [locationName, setLocationName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [activePin, setActivePin] = useState<any>(null);

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: pins = [] } = useListMapPins(familyId ?? "", {
    query: { enabled: !!familyId, queryKey: getListMapPinsQueryKey(familyId ?? "") }
  });

  const { data: members = [] } = useListMembers(familyId ?? "", {
    query: { enabled: !!familyId, queryKey: getListMembersQueryKey(familyId ?? "") }
  });

  const createPin = useCreateMapPin();
  const deletePin = useDeleteMapPin();

  const handleAddPin = () => {
    if (!selectedMember || !locationName || !lat || !lng) return;
    createPin.mutate({
      familyId: familyId!,
      data: {
        memberId: selectedMember,
        locationName,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      }
    }, {
      onSuccess: () => {
        toast({ title: "Pin added" });
        qc.invalidateQueries({ queryKey: getListMapPinsQueryKey(familyId ?? "") });
        setShowAddForm(false);
        setSelectedMember("");
        setLocationName("");
        setLat("");
        setLng("");
      }
    });
  };

  const removePin = (id: string) => {
    deletePin.mutate({ familyId: familyId!, pinId: id }, {
      onSuccess: () => {
        toast({ title: "Pin removed" });
        qc.invalidateQueries({ queryKey: getListMapPinsQueryKey(familyId ?? "") });
        setActivePin(null);
      }
    });
  };

  return (
    <div className="relative w-full h-full bg-[#a3c6d6] overflow-hidden">
      {/* SVG Map Fallback */}
      <div className="absolute inset-0 flex items-center justify-center opacity-80 pointer-events-none">
        <svg viewBox="0 0 1000 500" className="w-full h-full max-w-5xl" preserveAspectRatio="xMidYMid meet">
          <path d="M200 150 Q 250 100 300 120 T 350 200 T 250 300 T 150 250 Z" fill="#e2d2b5" stroke="#c0a07a" strokeWidth="2" />
          <path d="M500 100 Q 600 50 700 150 T 650 300 T 550 250 Z" fill="#e2d2b5" stroke="#c0a07a" strokeWidth="2" />
          <path d="M350 250 Q 400 200 450 350 T 380 450 T 320 350 Z" fill="#e2d2b5" stroke="#c0a07a" strokeWidth="2" />
          <path d="M700 200 Q 800 150 900 250 T 800 400 T 700 300 Z" fill="#e2d2b5" stroke="#c0a07a" strokeWidth="2" />
        </svg>
      </div>

      {/* Render Pins */}
      {pins.map((pin: any) => {
        const x = ((pin.longitude + 180) / 360) * 100;
        const y = ((90 - pin.latitude) / 180) * 100;
        const member = members.find((m: any) => m.id === pin.memberId);
        
        return (
          <div 
            key={pin.id} 
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={() => setActivePin({ ...pin, member })}
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-110">
                {member?.avatarUrl ? (
                  <img src={member.avatarUrl} alt={member.firstName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  `${member?.firstName?.[0] || '?'}${member?.lastName?.[0] || '?'}`
                )}
              </div>
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-white rotate-45 border-b-2 border-r-2 border-primary shadow-sm"></div>
            </div>
          </div>
        );
      })}

      {/* Active Pin Popup */}
      {activePin && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-card border border-border shadow-2xl rounded-xl p-4 w-64 z-20 animate-in slide-in-from-bottom-4">
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => setActivePin(null)}>
            <X className="w-3 h-3" />
          </Button>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden">
              {activePin.member?.avatarUrl ? (
                <img src={activePin.member.avatarUrl} alt={activePin.member.firstName} className="w-full h-full object-cover" />
              ) : (
                `${activePin.member?.firstName?.[0] || '?'}${activePin.member?.lastName?.[0] || '?'}`
              )}
            </div>
            <div>
              <div className="font-semibold text-sm">{activePin.member?.firstName} {activePin.member?.lastName}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {activePin.locationName}
              </div>
            </div>
          </div>
          {isGatekeeper && (
            <Button variant="destructive" size="sm" className="w-full text-xs h-8" onClick={() => removePin(activePin.id)}>
              <Trash2 className="w-3 h-3 mr-2" /> Remove Pin
            </Button>
          )}
        </div>
      )}

      {/* Gatekeeper Controls */}
      {isGatekeeper && (
        <div className="absolute top-4 right-4 z-20">
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)} className="shadow-lg">
              <Plus className="w-4 h-4 mr-2" /> Add Pin
            </Button>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 shadow-xl w-72">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">New Map Pin</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddForm(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Family Member</Label>
                  <Select value={selectedMember} onValueChange={setSelectedMember}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Location Name</Label>
                  <Input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="e.g. Paris, France" className="h-8 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Latitude</Label>
                    <Input value={lat} onChange={e => setLat(e.target.value)} placeholder="e.g. 48.85" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Longitude</Label>
                    <Input value={lng} onChange={e => setLng(e.target.value)} placeholder="e.g. 2.35" className="h-8 text-xs" />
                  </div>
                </div>
                <Button size="sm" className="w-full mt-2" onClick={handleAddPin} disabled={createPin.isPending || !selectedMember || !locationName || !lat || !lng}>
                  Save Pin
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}