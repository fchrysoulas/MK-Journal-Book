"""Rebuild the module's original synthesized paper/cover effects (Python + NumPy)."""
from pathlib import Path
import wave
import numpy as np

RATE = 44100
OUT = Path(__file__).resolve().parents[1] / 'assets' / 'sounds'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(74219)


def noise(n, width=5):
    raw = rng.normal(0, 1, n)
    return np.convolve(raw, np.ones(width) / width, mode='same')


def rustle(t, start, duration, strength, grain=7):
    u = (t-start)/duration
    envelope = np.sin(np.pi*np.clip(u,0,1))**1.5
    envelope *= (u>0)&(u<1)
    dry = noise(len(t),grain)-noise(len(t),60)*.35
    wrinkles = .7+.3*np.sin(2*np.pi*(23*t+9*t*t))**2
    return strength*dry*envelope*wrinkles


def tap(t, start, strength, decay=.07):
    u = np.maximum(0,t-start)
    envelope = (t>=start)*(1-np.exp(-u/.002))*np.exp(-u/decay)
    resonance = np.sin(2*np.pi*(102*u-29*u*u))+.32*np.sin(2*np.pi*193*u)
    return strength*envelope*(resonance*.65+noise(len(t),18)*.35)


def write(name, signal):
    # Short fades and conservative peak headroom avoid clicks/clipping at any module volume.
    fade = min(400,len(signal)//2)
    signal[:fade] *= np.linspace(0,1,fade)
    signal[-fade:] *= np.linspace(1,0,fade)
    signal -= signal.mean()
    signal *= .72/max(np.max(np.abs(signal)),.01)
    pcm = (np.clip(signal,-1,1)*32767).astype('<i2')
    with wave.open(str(OUT/name),'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(RATE);wav.writeframes(pcm.tobytes())
    print(f'{name}: {len(signal)/RATE:.2f}s, peak {np.max(np.abs(signal)):.2f}')

t=np.arange(round(.72*RATE))/RATE
opening=rustle(t,.015,.46,.8,14)+rustle(t,.22,.34,.55,6)+tap(t,.05,.15,.08)+tap(t,.50,.12,.045)
write('book-open.wav',opening)
t=np.arange(round(.66*RATE))/RATE
closing=rustle(t,.015,.40,.65,10)+tap(t,.36,.45,.085)+rustle(t,.37,.18,.28,4)
write('book-close.wav',closing)
t=np.arange(round(.46*RATE))/RATE
flipping=rustle(t,.005,.34,.85,4)+rustle(t,.18,.22,.5,9)+tap(t,.32,.07,.026)
write('page-flip.wav',flipping)
