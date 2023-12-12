int outPin = 9;
int inPin = 2;
int maxAnalogVal = 255;

int sinMap(double val) {
  int scaledVal = abs(val) * 255;
  return scaledVal;
}

void triggerPattern() {
  int step = 100;
  // int pattern = random(6);
  int pattern = 0;
  analogWrite(outPin, 0);

  switch (pattern) {
    case 0: {
      long duration = (long) 1 * 60 * 1000;
      for(long i=0; i<=duration; i+=step) {
        int output = map(i, 0, duration, 0, maxAnalogVal);
        analogWrite(outPin, output);
        delay(step);
      }
      break;
    }
    case 1: {
      long duration = (long) 3 * 60 * 1000;
      for(long i=0; i<=duration; i+=step) {
        int output = map(i, 0, duration, 0, maxAnalogVal);
        analogWrite(outPin, output);
        delay(step);
      }
      break;
    }
    case 2: {
      long duration = (long) 5 * 60 * 1000;
      for(long i=0; i<=duration; i+=step) {
        int output = map(i, 0, duration, 0, maxAnalogVal);
        analogWrite(outPin, output);
        delay(step);
      }
      break;
    }
    case 3: {
      long duration = (long) 1 * 60 * 1000;
      for(long i=0; i<=duration; i+=step) {
        float val = sin((float)i * M_PI / 2 * 1/duration);
        int output = sinMap(val);
        analogWrite(outPin, output);
        delay(step);
      }
      break;
    }
    case 4: {
      long duration = (long) 5 * 60 * 1000;
      for(long i=0; i<=duration; i+=step) {
        float val = sin((float)i * M_PI / 2 * 1/duration);
        int output = sinMap(val);
        analogWrite(outPin, output);
        delay(step);
      }
      break;
    }
    default: {
      long duration = (long) 1 * 60 * 1000;
      for(long i=0; i<=duration; i+=step) {
        float val = 2*(float)i/duration - sin((float)i * M_PI / 2 * 1/duration);
        int output = sinMap(val);
        analogWrite(outPin, output);
        delay(step);
      }
      break;
    }
  }
  analogWrite(outPin, 0);
}

void setup() {
  Serial.begin(9600);
  pinMode(outPin, OUTPUT);
  pinMode(inPin, INPUT); 
  analogWrite(outPin, 0);
}

void loop() {
  int buttonState = digitalRead(inPin);
  if(buttonState == HIGH) {
    triggerPattern();
  }
}
