import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetMediaGallery,
  getGetMediaGalleryQueryKey,
  useCreateMedia,
  useDeleteMedia,
  useGetUploadSignature,
  useListMembers,
  getListMembersQueryKey,
  GetMediaGalleryType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Image as ImageIcon, Video, Music, Upload, Trash2, X, ChevronLeft, ChevronRight, Play, Pause, Mic, Square } from "lucide-react";
import { format } from "date-fns";

function MediaUploader({ familyId, onSuccess }: { familyId: string; onSuccess: () => void }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const getSignature = useGetUploadSignature();
  const createMedia = useCreateMedia();
  const { toast } = useToast();
  
  const [taggedMembers] = useState<string[]>([]);
  const { data: _members } = useListMembers(familyId ?? "", {
    query: { enabled: !!familyId, queryKey: getListMembersQueryKey(familyId ?? "") }
  });

  const handleUpload = async (files: FileList | File[]) => {
    if (!files.length) return;
    setUploading(true);
    setProgress(10);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let type = "image";
        if (file.type.startsWith("video/")) type = "video";
        if (file.type.startsWith("audio/")) type = "audio";
        
        const sigResponse = await getSignature.mutateAsync({ data: { familyId } });
        const result = await uploadToCloudinary(file, sigResponse);
        
        await createMedia.mutateAsync({
          familyId,
          data: {
            cloudinaryId: result.public_id,
            url: result.secure_url,
            type: type as any,
            taggedMembers,
          }
        });
        setProgress(10 + Math.round(((i + 1) / files.length) * 90));
      }
      toast({ title: "Upload successful" });
      onSuccess();
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-border bg-card/50'}`}
      onDragOver={e => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
      onDrop={e => { e.preventDefault(); setDragActive(false); handleUpload(e.dataTransfer.files); }}
    >
      <Upload className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
      <h3 className="font-medium mb-1">Drag and drop media here</h3>
      <p className="text-sm text-muted-foreground mb-4">Supports photos, videos, and audio files</p>
      
      <input
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        className="hidden"
        ref={fileInputRef}
        onChange={e => e.target.files && handleUpload(e.target.files)}
      />
      
      <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
        {uploading ? `Uploading... ${progress}%` : "Select Files"}
      </Button>
    </div>
  );
}

function VoiceRecorder({ familyId, onSuccess }: { familyId: string; onSuccess: () => void }) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getSignature = useGetUploadSignature();
  const createMedia = useCreateMedia();
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      toast({ title: "Microphone access denied", description: "Allow microphone access to record voice notes.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const uploadRecording = async () => {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const file = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
      const sig = await getSignature.mutateAsync({ data: { familyId } });
      const result = await uploadToCloudinary(file, sig);
      await createMedia.mutateAsync({
        familyId,
        data: { cloudinaryId: result.public_id, url: result.secure_url, type: "audio" as any, taggedMembers: [] }
      });
      toast({ title: "Voice note saved to gallery" });
      discardRecording();
      onSuccess();
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const discardRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setSeconds(0);
  }, [audioUrl]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="p-4 bg-card/80 border border-border rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <Mic className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Record a Voice Note</span>
        <span className="text-xs text-muted-foreground">— capture oral family stories directly in the browser</span>
      </div>

      {!audioBlob ? (
        <div className="flex items-center gap-3">
          <Button
            variant={recording ? "destructive" : "outline"}
            size="sm"
            className="gap-2"
            onClick={recording ? stopRecording : startRecording}
          >
            {recording ? (
              <><Square className="w-3.5 h-3.5 fill-current" /> Stop Recording</>
            ) : (
              <><Mic className="w-3.5 h-3.5" /> Start Recording</>
            )}
          </Button>
          {recording && (
            <span className="flex items-center gap-2 text-sm text-destructive font-mono font-medium">
              <span className="w-2 h-2 rounded-full bg-destructive animate-ping inline-block" />
              {formatTime(seconds)}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <audio src={audioUrl!} controls className="h-9 flex-1 min-w-0" />
          <Button size="sm" onClick={uploadRecording} disabled={uploading} className="gap-1.5 shrink-0">
            {uploading ? "Saving…" : "Save to Gallery"}
          </Button>
          <Button size="sm" variant="ghost" onClick={discardRecording} disabled={uploading} className="shrink-0">
            Discard
          </Button>
        </div>
      )}
    </div>
  );
}

function AudioPlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };
  
  return (
    <div className="bg-muted p-4 rounded-lg flex items-center gap-4">
      <Button variant="secondary" size="icon" className="rounded-full flex-shrink-0" onClick={toggle}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>
      <div className="flex-1 flex items-center gap-1 h-8">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`w-1.5 bg-primary/60 rounded-full transition-all duration-100 ${playing ? 'animate-pulse' : ''}`}
            style={{
              height: playing ? `${Math.random() * 100}%` : '20%',
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
    </div>
  );
}

export default function Gallery() {
  const { familyId, user, isGatekeeper } = useAuth();
  const [filter, setFilter] = useState("all");
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const mediaParams = filter !== "all" ? { type: filter as typeof GetMediaGalleryType[keyof typeof GetMediaGalleryType] } : undefined;
  const { data: mediaItems, isLoading } = useGetMediaGallery(
    familyId ?? "",
    mediaParams,
    { query: { enabled: !!familyId, queryKey: getGetMediaGalleryQueryKey(familyId ?? "", mediaParams) } }
  );
  
  const deleteMedia = useDeleteMedia();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const items = (mediaItems as any)?.items || mediaItems || [];

  const refreshGallery = () => qc.invalidateQueries({ queryKey: getGetMediaGalleryQueryKey(familyId ?? "", mediaParams) });
  
  const handleDelete = (id: string) => {
    if (!confirm("Delete this media?")) return;
    deleteMedia.mutate({ familyId: familyId ?? "", mediaId: id }, {
      onSuccess: () => {
        refreshGallery();
        toast({ title: "Media deleted" });
      }
    });
  };
  
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold font-serif">Family Gallery</h1>

      <MediaUploader familyId={familyId ?? ""} onSuccess={refreshGallery} />
      <VoiceRecorder familyId={familyId ?? ""} onSuccess={refreshGallery} />

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All Media</TabsTrigger>
          <TabsTrigger value="image"><ImageIcon className="w-4 h-4 mr-2" /> Photos</TabsTrigger>
          <TabsTrigger value="video"><Video className="w-4 h-4 mr-2" /> Videos</TabsTrigger>
          <TabsTrigger value="audio"><Music className="w-4 h-4 mr-2" /> Audio</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="aspect-square bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl">
          <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-medium">No media found</h2>
          <p className="text-muted-foreground">Upload photos, videos, or record a voice note to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-max">
          {items.map((item: any, index: number) => {
            const canDelete = isGatekeeper || item.uploaderId === user?.id;
            return (
              <div key={item.id} className="group relative aspect-square rounded-xl overflow-hidden bg-muted border border-border">
                {item.type === "image" && (
                  <img src={item.url} alt="Gallery item" className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxIndex(index)} />
                )}
                {item.type === "video" && (
                  <div className="w-full h-full relative cursor-pointer bg-black" onClick={() => setLightboxIndex(index)}>
                    <video src={item.url} className="w-full h-full object-cover opacity-70" />
                    <Play className="absolute inset-0 m-auto text-white w-10 h-10 drop-shadow-md" />
                  </div>
                )}
                {item.type === "audio" && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-card p-4 gap-3">
                    <Mic className="w-8 h-8 text-primary/60" />
                    <AudioPlayer url={item.url} />
                  </div>
                )}
                
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-end">
                  <div className="text-white text-xs">
                    <p className="font-medium truncate">{item.uploaderName}</p>
                    <p className="opacity-80">{format(new Date(item.createdAt), "MMM d, yyyy")}</p>
                  </div>
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:text-red-400 hover:bg-black/40" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {lightboxIndex !== null && items[lightboxIndex] && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20" onClick={() => setLightboxIndex(null)}>
            <X className="w-6 h-6" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 text-white hover:bg-white/20 disabled:opacity-30"
            disabled={lightboxIndex === 0}
            onClick={() => setLightboxIndex(lightboxIndex - 1)}
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
          
          <div className="max-w-4xl max-h-[80vh] w-full flex items-center justify-center">
            {items[lightboxIndex].type === "image" ? (
              <img src={items[lightboxIndex].url} alt="Fullscreen" className="max-w-full max-h-[80vh] object-contain" />
            ) : items[lightboxIndex].type === "video" ? (
              <video src={items[lightboxIndex].url} controls autoPlay className="max-w-full max-h-[80vh] outline-none" />
            ) : null}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 text-white hover:bg-white/20 disabled:opacity-30"
            disabled={lightboxIndex === items.length - 1}
            onClick={() => setLightboxIndex(lightboxIndex + 1)}
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
          
          <div className="absolute bottom-4 inset-x-0 text-center text-white/70 text-sm">
            {lightboxIndex + 1} of {items.length} &bull; Uploaded by {items[lightboxIndex].uploaderName} on {format(new Date(items[lightboxIndex].createdAt), "MMM d, yyyy")}
          </div>
        </div>
      )}
    </div>
  );
}
