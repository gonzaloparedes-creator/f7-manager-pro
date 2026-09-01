import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { PlayCircle } from "lucide-react";
import { tutorialCategories, videoPlaceholders } from "@/data/tutorialsContent";
import TutorialImage from "@/components/TutorialImage";

export default function HowToUse() {
  useEffect(() => {
    document.title = "Cómo usar | F7 Manager Pro";
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cómo usar F7 Manager Pro</h1>
        <p className="text-sm text-muted-foreground">
          Guía paso a paso de cada módulo, organizada por tema, con capturas reales de la app.
        </p>
      </div>

      <Tabs defaultValue={tutorialCategories[0].id} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-10">
          {tutorialCategories.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id} className="h-9">
              <cat.icon className="mr-1 h-4 w-4" /> {cat.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="videos" className="h-9">
            <PlayCircle className="mr-1 h-4 w-4" /> Videos
          </TabsTrigger>
        </TabsList>

        {tutorialCategories.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="space-y-4">
            <p className="text-sm text-muted-foreground">{cat.description}</p>
            {cat.note && (
              <Card className="border-dashed bg-muted/40">
                <CardContent className="p-3 text-xs text-muted-foreground">{cat.note}</CardContent>
              </Card>
            )}
            <Accordion type="single" collapsible className="w-full">
              {cat.topics.map((topic) => (
                <AccordionItem key={topic.id} value={topic.id}>
                  <AccordionTrigger>
                    <span className="flex flex-1 flex-wrap items-center gap-2 text-left">
                      {topic.title}
                      {topic.badge && (
                        <Badge variant="secondary" className="font-normal">
                          {topic.badge.label}
                        </Badge>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    {topic.body.map((paragraph, i) => (
                      <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                        {paragraph}
                      </p>
                    ))}
                    {topic.images && topic.images.length > 0 && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {topic.images.map((img) => (
                          <TutorialImage key={img.file} file={img.file} alt={img.alt} />
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>
        ))}

        <TabsContent value="videos" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Video-tutoriales cortos por flujo de trabajo. Todavía no están disponibles, pero ya
            dejamos el espacio listo — pronto vas a poder verlos acá mismo.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videoPlaceholders.map((v) => (
              <Card key={v.id} className="opacity-60">
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-center justify-between">
                    <PlayCircle className="h-5 w-5 text-muted-foreground" />
                    <Badge variant="secondary">Próximamente</Badge>
                  </div>
                  <div className="font-medium">{v.title}</div>
                  <p className="text-sm text-muted-foreground">{v.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
