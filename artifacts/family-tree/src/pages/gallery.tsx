import { useState, useRef, useEffect, useCallback } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Image as ImageIcon, Video, Music, Upload, Trash2, X, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { format } from "date-fns";

function MediaUploader({ familyId, onSuccess }: { familyId: string; onSuccess: () => void }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const getSignature = useGetUploadSignature();
  const createMedia = useCreateMedia();
  const { toast } = useToast();
  
  // Minimal tagging
  const [taggedMembers, setTaggedMembers] = useState<string[]>([]);
  const { data: members } = useListMembers(familyId ?? "", {
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
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="mb-8">
      <div 
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-border bg-card/50'}`}
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
        onDrop={e => { e.preventDefault(); setDragActive(false); handleUpload(e.dataTransfer.files); }}
      >
        <Upload className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-medium mb-1">Drag and drop media here</h3>
        <p className="text-sm text-muted-foreground mb-4">Or click to browse files</p>
        
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
        {/* Animated bars */}
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
  
  const handleDelete = (id: string) => {
    if (!confirm("Delete this media?")) return;
    deleteMedia.mutate({ familyId: familyId ?? "", mediaId: id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMediaGalleryQueryKey(familyId ?? "", mediaParams) });
        toast({ title: "Media deleted" });
      }
    });
  };
  
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Family Gallery</h1>
      
      <MediaUploader 
        familyId={familyId ?? ""} 
        onSuccess={() => qc.invalidateQueries({ queryKey: getGetMediaGalleryQueryKey(familyId ?? "", mediaParams) })} 
      />
      
      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
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
          <p className="text-muted-foreground">Upload some photos or videos to get started.</p>
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
                  <div className="w-full h-full flex items-center justify-center bg-card p-4">
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
