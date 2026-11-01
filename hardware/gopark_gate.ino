// ESP32 tabletop gate demonstrator: low-voltage LED/relay and two beam sensors.
// Install ArduinoJson 7 through Arduino Library Manager. No mains wiring.
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER = "http://YOUR_COMPUTER_LAN_IP:4174/api/hardware";
const char* DEVICE_TOKEN = "PAIR_A_DEVICE_IN_GOPARK_SETUP_AND_PASTE_TOKEN_HERE";
const int BEAM_A = 13, BEAM_B = 14, GATE_LED_OR_RELAY = 26;
Preferences state;
unsigned long lastPoll=0, firstBeamAt=0, lastCrossingAt=0;
int firstBeam=0;
String eventId="", direction="";
uint32_t sequence=0;

void postEvent(const char* type,const String& movement) {
  if(WiFi.status()!=WL_CONNECTED){Serial.println("Offline: attendant must record passage. No booking was changed.");return;}
  sequence++;state.putUInt("sequence",sequence);
  JsonDocument body;body["type"]=type;body["eventId"]=eventId;body["direction"]=movement;body["sequence"]=sequence;
  String encoded;serializeJson(body,encoded);HTTPClient request;request.begin(SERVER);request.addHeader("Authorization",String("Bearer ")+DEVICE_TOKEN);request.addHeader("Content-Type","application/json");
  int code=request.POST(encoded);Serial.printf("Gate event status: %d\n",code);request.end();
}
void setup(){Serial.begin(115200);pinMode(BEAM_A,INPUT_PULLUP);pinMode(BEAM_B,INPUT_PULLUP);pinMode(GATE_LED_OR_RELAY,OUTPUT);digitalWrite(GATE_LED_OR_RELAY,LOW);state.begin("gopark",false);sequence=state.getUInt("sequence",0);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);}
void loop(){
  if(WiFi.status()==WL_CONNECTED&&millis()-lastPoll>1500){lastPoll=millis();HTTPClient request;request.begin(SERVER);request.addHeader("Authorization",String("Bearer ")+DEVICE_TOKEN);int code=request.GET();if(code==200){JsonDocument response;if(!deserializeJson(response,request.getString())&&!response["command"].isNull()){String next=response["command"]["eventId"].as<String>();if(next!=eventId){eventId=next;direction=response["command"]["direction"].as<String>();digitalWrite(GATE_LED_OR_RELAY,HIGH);delay(300);digitalWrite(GATE_LED_OR_RELAY,LOW);postEvent("opened",direction);}}}request.end();}
  bool a=digitalRead(BEAM_A)==LOW,b=digitalRead(BEAM_B)==LOW;
  if(millis()-lastCrossingAt>2000){if(!firstBeam&&a&&!b){firstBeam=1;firstBeamAt=millis();}else if(!firstBeam&&b&&!a){firstBeam=2;firstBeamAt=millis();}else if(firstBeam==1&&b){postEvent("crossing","entry");firstBeam=0;lastCrossingAt=millis();eventId="";}else if(firstBeam==2&&a){postEvent("crossing","exit");firstBeam=0;lastCrossingAt=millis();eventId="";}}
  if(firstBeam&&millis()-firstBeamAt>6000)firstBeam=0;
  delay(15);
}
