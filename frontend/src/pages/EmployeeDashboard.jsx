import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getMyVehicles,
  addVehicle,
  searchRides,
  bookRide,
  offerRide,
  getRideHistory,
  completeOrDeleteRide,
  updateBookingStatus,
  startRide,
  getWalletBalance,
  rechargeWallet,
  payBooking,
  getUnpaidBookings,
} from "../services/api";
import {
  Car,
  Search,
  PlusCircle,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Users,
  ShieldCheck,
  Navigation,
  History,
  Plus,
  AlertCircle,
  CheckCircle2,
  XCircle,
  CheckCircle,
  Wallet,
  CreditCard,
  ArrowUpCircle,
  TrendingUp,
  PlayCircle,
  Zap,
  ReceiptText,
} from "lucide-react";
import LocationAutocomplete from "../components/LocationAutocomplete";
import MapDisplay from "../components/MapDisplay";
import { supabase } from "../services/supabaseClient";
import { io } from "socket.io-client";

// Helper: Geocode location name to coords via Nominatim
const geocodeLocation = async (address) => {
  if (!address) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
    }
  } catch (e) {
    console.error("Geocoding failed:", e);
  }
  return null;
};

// Helper: Fetch driving distance in km via OSRM
const fetchDistance = async (startLat, startLon, endLat, endLon) => {
  if (!startLat || !startLon || !endLat || !endLon) return null;
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=false`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        return data.routes[0].distance / 1000; // convert meters to km
      }
    }
  } catch (e) {
    console.error("Failed to calculate distance:", e);
  }
  return null;
};

// Helper: Fetch driving distance in km for multiple stops via OSRM
const fetchMultiStopDistance = async (stops) => {
  const validStops = stops.filter((s) => s && s.lat && s.lon);
  if (validStops.length < 2) return 0;
  try {
    const coordsString = validStops.map((s) => `${s.lon},${s.lat}`).join(";");
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=false`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        return data.routes[0].distance / 1000;
      }
    }
  } catch (e) {
    console.error("Failed to calculate multi-stop distance:", e);
  }
  return null;
};

export default function EmployeeDashboard() {
  const { user } = useAuth();

  // State for socket.io live chat & voice call
  const [activeCommRide, setActiveCommRide] = useState(null);
  const [socket, setSocket] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  // WebRTC refs and states
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const [isInVoiceCall, setIsInVoiceCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      let chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result;
          if (socket && activeCommRide) {
            socket.emit("voice_note", {
              rideId: activeCommRide.id,
              audioBase64: base64Audio,
              senderId: user.id,
              senderName: user.fullName
            });
            setChatMessages((prev) => [...prev, {
              id: Math.random().toString(36).substring(7),
              senderName: "You",
              senderId: user.id,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              isVoice: true,
              audioBase64: base64Audio
            }]);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or failed:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
  };

  const playVoiceNote = (base64Audio) => {
    const audio = new Audio(base64Audio);
    audio.play().catch((e) => console.error("Audio playback error:", e));
  };

  const handleJoinVoiceCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setIsInVoiceCall(true);
      setIsMuted(false);

      if (socket && activeCommRide) {
        socket.emit("join_voice_call", {
          rideId: activeCommRide.id,
          userId: user.id,
          userName: user.fullName
        });
      }
    } catch (err) {
      console.error("Microphone access failed:", err);
      alert("Could not access microphone for live call. Please verify permissions.");
    }
  };

  const handleLeaveVoiceCall = () => {
    if (socket && activeCommRide) {
      socket.emit("leave_voice_call", { rideId: activeCommRide.id });
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    Object.keys(peerConnectionsRef.current).forEach(socketId => {
      peerConnectionsRef.current[socketId].close();
      removeRemoteAudio(socketId);
    });
    peerConnectionsRef.current = {};
    setIsInVoiceCall(false);
  };

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      const enabled = isMuted;
      localStreamRef.current.getAudioTracks().forEach(track => track.enabled = enabled);
      setIsMuted(!isMuted);
    }
  };

  const addRemoteAudio = (socketId, stream) => {
    let audioEl = document.getElementById(`audio_${socketId}`);
    if (!audioEl) {
      audioEl = document.createElement("audio");
      audioEl.id = `audio_${socketId}`;
      audioEl.autoplay = true;
      audioEl.style.display = "none";
      document.body.appendChild(audioEl);
    }
    audioEl.srcObject = stream;
  };

  const removeRemoteAudio = (socketId) => {
    const audioEl = document.getElementById(`audio_${socketId}`);
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.remove();
    }
  };

  const handleOpenCommHub = (ride) => {
    setActiveCommRide(ride);
    setChatMessages([]);

    // Connect to backend port 5000 (standard for local backend)
    const socketUrl =
      window.location.protocol + "//" + window.location.hostname + ":5000";
    const s = io(socketUrl);
    setSocket(s);

    s.emit("join_ride", {
      rideId: ride.id,
      userId: user.id,
      userName: user.fullName,
    });

    s.on("receive_message", (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    s.on("receive_voice_note", (voice) => {
      playVoiceNote(voice.audioBase64);
      setChatMessages((prev) => [
        ...prev,
        {
          id: voice.id,
          senderName: voice.senderName,
          senderId: voice.senderId,
          timestamp: voice.timestamp,
          isVoice: true,
          audioBase64: voice.audioBase64,
        },
      ]);
    });

    // Passenger receives live vehicle location from driver
    s.on("location_updated", ({ lat, lon, eta }) => {
      setVehicleLiveCoords(prev => ({ ...prev, [ride.id]: { lat, lon, eta } }));
    });

    // WebRTC signaling event handlers
    s.on("user_joined_voice", async ({ socketId, userName }) => {
      console.log("Peer joined voice call:", userName, socketId);
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      });
      peerConnectionsRef.current[socketId] = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          s.emit("send_signal", {
            targetSocketId: socketId,
            signal: { candidate: event.candidate }
          });
        }
      };

      pc.ontrack = (event) => {
        addRemoteAudio(socketId, event.streams[0]);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      s.emit("send_signal", {
        targetSocketId: socketId,
        signal: { sdp: pc.localDescription }
      });
    });

    s.on("receive_signal", async ({ senderSocketId, signal }) => {
      let pc = peerConnectionsRef.current[senderSocketId];

      if (!pc) {
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
          ]
        });
        peerConnectionsRef.current[senderSocketId] = pc;

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            s.emit("send_signal", {
              targetSocketId: senderSocketId,
              signal: { candidate: event.candidate }
            });
          }
        };

        pc.ontrack = (event) => {
          addRemoteAudio(senderSocketId, event.streams[0]);
        };
      }

      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          s.emit("send_signal", {
            targetSocketId: senderSocketId,
            signal: { sdp: pc.localDescription }
          });
        }
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    });

    s.on("user_left_voice", ({ socketId }) => {
      console.log("Peer left voice call:", socketId);
      const pc = peerConnectionsRef.current[socketId];
      if (pc) pc.close();
      delete peerConnectionsRef.current[socketId];
      removeRemoteAudio(socketId);
    });
  };

  const handleCloseCommHub = () => {
    handleLeaveVoiceCall();
    if (socket) {
      socket.disconnect();
    }
    setSocket(null);
    setActiveCommRide(null);
    setChatMessages([]);
  };

  const [activeTab, setActiveTab] = useState("find"); // find, current, offer, history, vehicles, wallet, payment

  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);

  // Payment state
  const [unpaidBookings, setUnpaidBookings] = useState([]);
  const [selectedPayBooking, setSelectedPayBooking] = useState(null);
  const [selectedHistoryRide, setSelectedHistoryRide] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Live tracking state (per ride)
  const [vehicleLiveCoords, setVehicleLiveCoords] = useState({}); // rideId -> { lat, lon, eta }
  const [simulating, setSimulating] = useState({}); // rideId -> boolean
  const simIntervalRef = useRef({});



  // State for Add Vehicle
  const [vehicles, setVehicles] = useState([]);
  const [newVehicle, setNewVehicle] = useState({
    makeModel: "",
    licensePlate: "",
    capacity: "",
  });

  // State for Find Ride
  const [availableRides, setAvailableRides] = useState([]);
  const [activeBookingRideId, setActiveBookingRideId] = useState(null);
  const [bookingParams, setBookingParams] = useState({
    pickupLocation: "",
    pickupLat: null,
    pickupLon: null,
    seats: 1,
    distanceKm: null,
    fare: null,
  });
  const [geocodedRide, setGeocodedRide] = useState(null);

  // State for Offer Ride
  const [offerForm, setOfferForm] = useState({
    vehicleId: "",
    pickupLocation: "",
    destination: "",
    departureDate: "",
    departureTime: "",
    availableSeats: "",
    farePerSeat: "",
    pickupLat: null,
    pickupLon: null,
    destinationLat: null,
    destinationLon: null,
  });

  // State for History and Current Rides
  const [rideHistory, setRideHistory] = useState([]);
  const [requestDetours, setRequestDetours] = useState({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Calculate detour distances for pending requests
  useEffect(() => {
    const calculateAllDetours = async () => {
      const detoursMap = {};

      const activeDriverRides = rideHistory.filter(
        (r) =>
          r.user_role === "Driver" &&
          (r.status === "Open" || r.status === "In Progress"),
      );

      for (let ride of activeDriverRides) {
        const start = {
          lat: parseFloat(ride.pickup_lat),
          lon: parseFloat(ride.pickup_lon),
        };
        const end = {
          lat: parseFloat(ride.destination_lat),
          lon: parseFloat(ride.destination_lon),
        };

        if (!start.lat || !start.lon || !end.lat || !end.lon) continue;

        const confirmedRiders = (ride.bookings || []).filter(
          (b) => b.status === "Confirmed",
        );
        const confirmedStops = confirmedRiders
          .map((rider) => ({
            lat: parseFloat(rider.pickup_lat),
            lon: parseFloat(rider.pickup_lon),
          }))
          .filter((c) => c.lat && c.lon);

        const baseDist = await fetchMultiStopDistance([
          start,
          ...confirmedStops,
          end,
        ]);

        const pendingRequests = (ride.bookings || []).filter(
          (b) => b.status === "Requested",
        );
        for (let req of pendingRequests) {
          const reqPickup = {
            lat: parseFloat(req.pickup_lat),
            lon: parseFloat(req.pickup_lon),
          };
          if (reqPickup.lat && reqPickup.lon) {
            const detourDist = await fetchMultiStopDistance([
              start,
              ...confirmedStops,
              reqPickup,
              end,
            ]);
            if (baseDist !== null && detourDist !== null) {
              const extraDist = detourDist - baseDist;
              detoursMap[req.id] = {
                baseDistance: parseFloat(baseDist.toFixed(2)),
                detourDistance: parseFloat(detourDist.toFixed(2)),
                extraDistance: parseFloat(Math.max(0, extraDist).toFixed(2)),
              };
            }
          }
        }
      }

      setRequestDetours(detoursMap);
    };

    if (rideHistory.length > 0) {
      calculateAllDetours();
    }
  }, [rideHistory]);

  useEffect(() => {
    loadVehicles();
    loadRides();
    loadHistory();
    if (activeTab === "wallet") loadWalletData();
    if (activeTab === "payment") { loadUnpaidBookings(); loadWalletData(); }
  }, [activeTab]);


  useEffect(() => {
    const channel = supabase
      .channel("employee-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides" },
        () => {
          loadRides();
          loadHistory();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          loadRides();
          loadHistory();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const showMsg = (msg, isError = false) => {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => {
      setError("");
      setSuccess("");
    }, 4000);
  };

  const loadVehicles = async () => {
    try {
      const v = await getMyVehicles();
      setVehicles(v);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRides = async () => {
    try {
      const r = await searchRides();
      setAvailableRides(r);
    } catch (err) {
      console.error(err);
    }
  };

  const loadHistory = async () => {
    try {
      const h = await getRideHistory();
      setRideHistory(h);
    } catch (err) {
      console.error(err);
    }
  };

  const loadWalletData = async () => {
    try {
      const data = await getWalletBalance();
      setWalletBalance(parseFloat(data.balance) || 0);
      setWalletTransactions(data.transactions || []);
    } catch (err) {
      console.error("Failed to load wallet data:", err);
    }
  };

  const loadUnpaidBookings = async () => {
    try {
      const data = await getUnpaidBookings();
      setUnpaidBookings(data || []);
    } catch (err) {
      console.error("Failed to load unpaid bookings:", err);
    }
  };

  const handleRechargeWallet = async (amount) => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { showMsg("Please enter a valid amount", true); return; }
    setWalletLoading(true);
    try {
      const res = await rechargeWallet(parsed);
      setWalletBalance(parseFloat(res.balance));
      showMsg(`✅ Wallet recharged with $${parsed.toFixed(2)}!`);
      setRechargeAmount("");
      loadWalletData();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setWalletLoading(false);
    }
  };

  const handlePayBooking = async () => {
    if (!selectedPayBooking) { showMsg("Please select a booking to pay", true); return; }
    setPaymentLoading(true);
    try {
      const res = await payBooking(selectedPayBooking.booking_id, paymentMethod);
      showMsg(`✅ ${res.message}`);
      setSelectedPayBooking(null);
      loadUnpaidBookings();
      if (paymentMethod === "Wallet") loadWalletData();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleStartRide = async (rideId) => {
    if (!window.confirm("Start this ride? Status will change to 'In Progress'.")) return;
    setLoading(true);
    try {
      await startRide(rideId);
      showMsg("Ride started! You are now driving.");
      loadHistory();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  // Driver: simulate moving along OSRM route and broadcast via socket
  const startDrivingSimulation = async (ride, socketInst) => {
    if (!ride.pickup_lat || !ride.destination_lat) {
      showMsg("Cannot simulate: ride coordinates missing.", true); return;
    }
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${ride.pickup_lon},${ride.pickup_lat};${ride.destination_lon},${ride.destination_lat}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (!data.routes || !data.routes[0]) { showMsg("Could not fetch route for simulation.", true); return; }
      const coords = data.routes[0].geometry.coordinates; // [[lon, lat], ...]
      const totalDuration = data.routes[0].duration; // seconds
      let stepIndex = 0;
      const step = Math.max(1, Math.floor(coords.length / 60)); // ~60 steps

      setSimulating(prev => ({ ...prev, [ride.id]: true }));

      const interval = setInterval(() => {
        if (stepIndex >= coords.length) {
          clearInterval(interval);
          delete simIntervalRef.current[ride.id];
          setSimulating(prev => ({ ...prev, [ride.id]: false }));
          return;
        }
        const [lon, lat] = coords[stepIndex];
        const remaining = Math.round(totalDuration * (1 - stepIndex / coords.length));
        const minutes = Math.floor(remaining / 60);
        const eta = `${minutes} min${minutes !== 1 ? "s" : ""}`;
        setVehicleLiveCoords(prev => ({ ...prev, [ride.id]: { lat, lon, eta } }));
        if (socketInst) {
          socketInst.emit("update_location", { rideId: ride.id, lat, lon, eta });
        }
        stepIndex += step;
      }, 1200);

      simIntervalRef.current[ride.id] = interval;
    } catch (err) {
      console.error("Simulation error:", err);
      showMsg("Simulation failed.", true);
    }
  };

  const stopDrivingSimulation = (rideId) => {
    if (simIntervalRef.current[rideId]) {
      clearInterval(simIntervalRef.current[rideId]);
      delete simIntervalRef.current[rideId];
    }
    setSimulating(prev => ({ ...prev, [rideId]: false }));
    setVehicleLiveCoords(prev => { const n = { ...prev }; delete n[rideId]; return n; });
  };



  const handleAddVehicle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addVehicle(newVehicle);
      showMsg("Vehicle registered successfully!");
      setNewVehicle({ makeModel: "", licensePlate: "", capacity: "" });
      loadVehicles();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleOfferRide = async (e) => {
    e.preventDefault();
    if (!offerForm.pickupLat || !offerForm.destinationLat) {
      showMsg(
        "Please select valid pickup and destination locations from the map recommendation dropdown.",
        true,
      );
      return;
    }

    // Validate against selected vehicle's capacity
    const selectedVehicle = vehicles.find((v) => v.id === offerForm.vehicleId);
    if (
      selectedVehicle &&
      parseInt(offerForm.availableSeats) > selectedVehicle.capacity
    ) {
      showMsg(
        `You cannot offer more seats than your vehicle's capacity (${selectedVehicle.capacity} seats).`,
        true,
      );
      return;
    }

    setLoading(true);
    try {
      await offerRide(offerForm);
      showMsg("Ride offered successfully!");
      setOfferForm({
        vehicleId: "",
        pickupLocation: "",
        destination: "",
        departureDate: "",
        departureTime: "",
        availableSeats: "",
        farePerSeat: "",
        pickupLat: null,
        pickupLon: null,
        destinationLat: null,
        destinationLon: null,
      });
      setActiveTab("current");
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  // Expand a ride card to enter custom pickup location, calculate distance, and show preview map
  const handleOpenBookingPanel = async (ride) => {
    setActiveBookingRideId(ride.id);
    setLoading(true);

    let lat = ride.pickup_lat;
    let lon = ride.pickup_lon;
    let destLat = ride.destination_lat;
    let destLon = ride.destination_lon;

    // Geocode fallback for legacy seeded data
    if (!lat || !lon) {
      const coords = await geocodeLocation(ride.pickup_location);
      if (coords) {
        lat = coords.lat;
        lon = coords.lon;
      }
    }
    if (!destLat || !destLon) {
      const coords = await geocodeLocation(ride.destination);
      if (coords) {
        destLat = coords.lat;
        destLon = coords.lon;
      }
    }

    const geocoded = {
      pickup_lat: lat,
      pickup_lon: lon,
      destination_lat: destLat,
      destination_lon: destLon,
    };

    setGeocodedRide(geocoded);

    // Initialize booking params
    setBookingParams({
      pickupLocation: ride.pickup_location,
      pickupLat: lat,
      pickupLon: lon,
      seats: 1,
      distanceKm: null,
      fare: null,
    });

    setLoading(false);
  };

  // Dynamically calculate distance and fare when pickup location or seats change
  useEffect(() => {
    if (
      !activeBookingRideId ||
      !bookingParams.pickupLat ||
      !bookingParams.pickupLon ||
      !geocodedRide
    )
      return;

    const calculateDistanceAndFare = async () => {
      const ride = availableRides.find((r) => r.id === activeBookingRideId);
      if (!ride) return;

      // Skip calculation if seat count is invalid
      if (
        bookingParams.seats === "" ||
        bookingParams.seats > ride.available_seats ||
        bookingParams.seats < 1
      ) {
        setBookingParams((prev) => ({
          ...prev,
          fare: null,
        }));
        return;
      }

      const dist = await fetchDistance(
        bookingParams.pickupLat,
        bookingParams.pickupLon,
        geocodedRide.destination_lat,
        geocodedRide.destination_lon,
      );

      if (dist !== null) {
        const costPerKm = parseFloat(ride.fare_per_seat);
        const calculatedFare = dist * costPerKm * bookingParams.seats;
        setBookingParams((prev) => ({
          ...prev,
          distanceKm: parseFloat(dist.toFixed(2)),
          fare: parseFloat(calculatedFare.toFixed(2)),
        }));
      }
    };

    const timer = setTimeout(calculateDistanceAndFare, 200);
    return () => clearTimeout(timer);
  }, [
    bookingParams.pickupLat,
    bookingParams.pickupLon,
    bookingParams.seats,
    activeBookingRideId,
    geocodedRide,
    availableRides,
  ]);

  const handleSendBookingRequest = async (rideId) => {
    if (!bookingParams.pickupLat) {
      showMsg("Please select a valid pickup location.", true);
      return;
    }

    const ride = availableRides.find((r) => r.id === rideId);
    if (ride && bookingParams.seats > ride.available_seats) {
      showMsg(
        `You cannot request more than the available ${ride.available_seats} seats.`,
        true,
      );
      return;
    }

    setLoading(true);
    try {
      await bookRide({
        rideId,
        seats: bookingParams.seats,
        pickupLocation: bookingParams.pickupLocation,
        pickupLat: bookingParams.pickupLat,
        pickupLon: bookingParams.pickupLon,
        distanceKm: bookingParams.distanceKm,
        fare: bookingParams.fare,
      });
      showMsg("Booking request submitted! Waiting for driver approval.");
      setActiveBookingRideId(null);
      loadRides();
      loadHistory();
      setActiveTab("current");
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBooking = async (bookingId, status) => {
    if (
      !window.confirm(
        `Are you sure you want to ${status === "Confirmed" ? "accept" : "decline"} this passenger's request?`,
      )
    )
      return;
    setLoading(true);
    try {
      await updateBookingStatus(bookingId, status);
      showMsg(
        `Request has been ${status === "Confirmed" ? "accepted" : "declined"} successfully!`,
      );
      loadHistory();
      loadRides();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleRideAction = async (rideId, action) => {
    let reason = "";
    if (action === "Delete") {
      reason = window.prompt("Please enter a reason for cancelling this ride:");
      if (reason === null) return;
    } else {
      if (!window.confirm("Are you sure you want to complete this ride?"))
        return;
    }
    setLoading(true);
    try {
      await completeOrDeleteRide(rideId, action, reason);
      showMsg(
        `Ride ${action === "Delete" ? "cancelled" : "completed"} successfully!`,
      );
      loadHistory();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  // Identify active rides (Open or In Progress) for Driver and Passenger
  const activeDriverRides = rideHistory.filter(
    (r) =>
      r.user_role === "Driver" &&
      (r.status === "Open" || r.status === "In Progress"),
  );

  const activePassengerRides = rideHistory.filter(
    (r) =>
      r.user_role === "Passenger" &&
      (r.status === "Open" || r.status === "In Progress") &&
      r.booking_status !== "Declined",
  );

  // Focus a request to preview its detour on the map
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  return (
    <div className="odoo-container">
      {/* Welcome Banner */}
      <div className="odoo-hero" style={{ padding: "2.5rem 2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span
              className="odoo-badge"
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "white",
                borderColor: "rgba(255,255,255,0.3)",
                marginBottom: "0.75rem",
                display: "inline-block",
              }}
            >
              {user?.organization?.name}
            </span>
            <h1>Welcome, {user?.fullName}!</h1>
          </div>
          <div
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              padding: "1rem",
              borderRadius: "10px",
              minWidth: "200px",
            }}
          >
            <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
              EMPLOYEE STATUS
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
              Verified Commuter
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="odoo-tabs" style={{ marginBottom: "2rem" }}>
        <button
          className={`odoo-tab ${activeTab === "find" ? "active" : ""}`}
          onClick={() => setActiveTab("find")}
        >
          <Search size={16} style={{ display: "inline", marginRight: "6px" }} />{" "}
          Book a Ride
        </button>
        <button
          className={`odoo-tab ${activeTab === "current" ? "active" : ""}`}
          onClick={() => setActiveTab("current")}
        >
          <Navigation
            size={16}
            style={{ display: "inline", marginRight: "6px" }}
          />{" "}
          Current Ride
        </button>
        <button
          className={`odoo-tab ${activeTab === "offer" ? "active" : ""}`}
          onClick={() => setActiveTab("offer")}
        >
          <Car size={16} style={{ display: "inline", marginRight: "6px" }} />{" "}
          Offer a Ride
        </button>
        <button
          className={`odoo-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <History
            size={16}
            style={{ display: "inline", marginRight: "6px" }}
          />{" "}
          Ride History
        </button>
        <button
          className={`odoo-tab ${activeTab === "vehicles" ? "active" : ""}`}
          onClick={() => setActiveTab("vehicles")}
        >
          <PlusCircle
            size={16}
            style={{ display: "inline", marginRight: "6px" }}
          />{" "}
          My Vehicles
        </button>
        <button
          className={`odoo-tab ${activeTab === "wallet" ? "active" : ""}`}
          onClick={() => setActiveTab("wallet")}
        >
          <Wallet
            size={16}
            style={{ display: "inline", marginRight: "6px" }}
          />{" "}
          Wallet
        </button>
        <button
          className={`odoo-tab ${activeTab === "payment" ? "active" : ""}`}
          onClick={() => setActiveTab("payment")}
        >
          <CreditCard
            size={16}
            style={{ display: "inline", marginRight: "6px" }}
          />{" "}
          Payments
        </button>
      </div>


      {error && (
        <div
          style={{
            background: "#fff3cd",
            color: "#856404",
            padding: "1rem",
            borderRadius: "6px",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            zIndex: 9999,
          }}
        >
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {success && (
        <div
          style={{
            background: "#d4edda",
            color: "#155724",
            padding: "1rem",
            borderRadius: "6px",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            zIndex: 9999,
          }}
        >
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {/* Tab Content */}
      <div className="odoo-card">
        {/* Book Ride Tab */}
        {activeTab === "find" && (
          <div>
            <h3 style={{ marginBottom: "1.5rem", color: "var(--odoo-violet)" }}>
              Available Rides in {user?.organization?.name}
            </h3>
            {availableRides.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>
                No open rides available at the moment.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                {availableRides.map((ride) => {
                  const isBooking = activeBookingRideId === ride.id;
                  return (
                    <div
                      key={ride.id}
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        padding: "1.25rem",
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              fontSize: "1.25rem",
                              color: "var(--odoo-violet)",
                            }}
                          >
                            {ride.pickup_location} → {ride.destination}
                          </strong>
                          <div
                            style={{
                              display: "flex",
                              gap: "1rem",
                              color: "var(--text-muted)",
                              fontSize: "0.9rem",
                              marginTop: "0.5rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <span>
                              <Calendar
                                size={14}
                                style={{
                                  verticalAlign: "text-bottom",
                                  marginRight: "4px",
                                }}
                              />{" "}
                              {new Date(
                                ride.departure_date,
                              ).toLocaleDateString()}
                            </span>
                            <span>
                              <Clock
                                size={14}
                                style={{
                                  verticalAlign: "text-bottom",
                                  marginRight: "4px",
                                }}
                              />{" "}
                              {ride.departure_time}
                            </span>
                            <span>
                              <Car
                                size={14}
                                style={{
                                  verticalAlign: "text-bottom",
                                  marginRight: "4px",
                                }}
                              />{" "}
                              {ride.vehicle_make}
                              {ride.vehicle_license_plate && (
                                <span style={{ marginLeft: "6px", background: "#e9ecef", border: "1px solid #ced4da", borderRadius: "4px", padding: "1px 6px", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.5px", color: "#495057" }}>
                                  {ride.vehicle_license_plate}
                                </span>
                              )}
                            </span>
                            <span>
                              <Users
                                size={14}
                                style={{
                                  verticalAlign: "text-bottom",
                                  marginRight: "4px",
                                }}
                              />{" "}
                              {ride.available_seats} seats left
                            </span>
                            <span>
                              <ShieldCheck
                                size={14}
                                style={{
                                  verticalAlign: "text-bottom",
                                  marginRight: "4px",
                                }}
                              />{" "}
                              Driver: {ride.driver_name}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: "1.5rem",
                              fontWeight: 700,
                              color: "var(--odoo-teal)",
                            }}
                          >
                            ${ride.fare_per_seat}
                            <span
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: 500,
                                color: "var(--text-muted)",
                              }}
                            >
                              /km
                            </span>
                          </div>
                          {!isBooking && (
                            <button
                              className="btn btn-primary"
                              style={{ marginTop: "0.5rem" }}
                              onClick={() => handleOpenBookingPanel(ride)}
                              disabled={loading}
                            >
                              Book Ride
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Booking Request Section */}
                      {isBooking && geocodedRide && (
                        <div
                          style={{
                            borderTop: "1px solid var(--border-color)",
                            marginTop: "1.25rem",
                            paddingTop: "1.25rem",
                          }}
                        >
                          <h4
                            style={{
                              color: "var(--odoo-teal)",
                              marginBottom: "1rem",
                            }}
                          >
                            Request Ride Booking
                          </h4>
                          <div
                            style={{
                              display: "flex",
                              gap: "1.5rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ flex: "1 1 350px" }}>
                              <div className="form-group">
                                <label className="form-label">
                                  Customize Your Pickup Location
                                </label>
                                <LocationAutocomplete
                                  value={bookingParams.pickupLocation}
                                  onChange={(val, item) =>
                                    setBookingParams({
                                      ...bookingParams,
                                      pickupLocation: val,
                                      pickupLat: item
                                        ? parseFloat(item.lat)
                                        : null,
                                      pickupLon: item
                                        ? parseFloat(item.lon)
                                        : null,
                                    })
                                  }
                                  placeholder="Enter custom pickup spot..."
                                  required
                                />
                                <small
                                  style={{
                                    color: "var(--text-muted)",
                                    display: "block",
                                    marginTop: "4px",
                                  }}
                                >
                                  Default pickup: <b>{ride.pickup_location}</b>
                                </small>
                              </div>

                              <div
                                className="form-group"
                                style={{ maxWidth: "120px" }}
                              >
                                <label className="form-label">
                                  Seats Required
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max={ride.available_seats}
                                  className="form-control"
                                  value={bookingParams.seats}
                                  onChange={(e) =>
                                    setBookingParams({
                                      ...bookingParams,
                                      seats:
                                        e.target.value !== ""
                                          ? parseInt(e.target.value)
                                          : "",
                                    })
                                  }
                                  required
                                />
                                {bookingParams.seats !== "" &&
                                  bookingParams.seats >
                                    ride.available_seats && (
                                    <span
                                      style={{
                                        color: "#dc3545",
                                        fontSize: "0.8rem",
                                        display: "block",
                                        marginTop: "4px",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Cannot exceed {ride.available_seats}{" "}
                                      available seats.
                                    </span>
                                  )}
                                {bookingParams.seats !== "" &&
                                  bookingParams.seats < 1 && (
                                    <span
                                      style={{
                                        color: "#dc3545",
                                        fontSize: "0.8rem",
                                        display: "block",
                                        marginTop: "4px",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Must request at least 1 seat.
                                    </span>
                                  )}
                              </div>

                              <div
                                style={{
                                  background: "#f8f9fa",
                                  padding: "1rem",
                                  borderRadius: "6px",
                                  marginBottom: "1.25rem",
                                  borderLeft: "4px solid var(--odoo-teal)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    marginBottom: "0.25rem",
                                  }}
                                >
                                  <span>Passenger Travel Distance:</span>
                                  <strong>
                                    {bookingParams.distanceKm !== null
                                      ? `${bookingParams.distanceKm} km`
                                      : "Calculating..."}
                                  </strong>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    marginBottom: "0.25rem",
                                  }}
                                >
                                  <span>Rate per km:</span>
                                  <span>${ride.fare_per_seat}/km</span>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    borderTop: "1px solid #dee2e6",
                                    marginTop: "0.5rem",
                                    paddingTop: "0.5rem",
                                    fontWeight: 700,
                                    color: "var(--odoo-teal)",
                                  }}
                                >
                                  <span>Total Payment (Fare):</span>
                                  <span>
                                    {bookingParams.fare !== null
                                      ? `$${bookingParams.fare}`
                                      : "--"}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: "0.75rem" }}>
                                <button
                                  className="btn btn-teal"
                                  onClick={() =>
                                    handleSendBookingRequest(ride.id)
                                  }
                                  disabled={
                                    loading ||
                                    bookingParams.distanceKm === null ||
                                    bookingParams.seats === "" ||
                                    bookingParams.seats >
                                      ride.available_seats ||
                                    bookingParams.seats < 1
                                  }
                                >
                                  Send Ride Request
                                </button>
                                <button
                                  className="btn btn-outline"
                                  onClick={() => setActiveBookingRideId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>

                            <div
                              style={{ flex: "1 1 300px", minHeight: "260px" }}
                            >
                              <MapDisplay
                                startCoords={{
                                  lat: geocodedRide.pickup_lat,
                                  lon: geocodedRide.pickup_lon,
                                }}
                                endCoords={{
                                  lat: geocodedRide.destination_lat,
                                  lon: geocodedRide.destination_lon,
                                }}
                                requestCoords={
                                  bookingParams.pickupLat
                                    ? {
                                        lat: bookingParams.pickupLat,
                                        lon: bookingParams.pickupLon,
                                      }
                                    : null
                                }
                                height="280px"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Current Ride Tab */}
        {activeTab === "current" && (
          <div>
            <h3 style={{ marginBottom: "1.5rem", color: "var(--odoo-violet)" }}>
              Your Active Rides & Requests
            </h3>

            {activeDriverRides.length === 0 &&
            activePassengerRides.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem 1.5rem",
                  background: "#f8f9fa",
                  borderRadius: "8px",
                }}
              >
                <Navigation
                  size={48}
                  color="var(--text-muted)"
                  style={{ margin: "0 auto 1.5rem", opacity: 0.6 }}
                />
                <h4>No Active Rides Found</h4>
                <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>
                  You don't have any pending requests or confirmed carpools at
                  the moment.
                </p>
                <div
                  style={{
                    marginTop: "1.5rem",
                    display: "flex",
                    gap: "1rem",
                    justifyContent: "center",
                  }}
                >
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab("find")}
                  >
                    Find a Ride
                  </button>
                  <button
                    className="btn btn-teal"
                    onClick={() => setActiveTab("offer")}
                  >
                    Offer a Ride
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2rem",
                }}
              >
                {/* 1. Driver Active Rides */}
                {activeDriverRides.map((ride) => {
                  const pendingRequests = (ride.bookings || []).filter(
                    (b) => b.status === "Requested",
                  );
                  const confirmedRiders = (ride.bookings || []).filter(
                    (b) => b.status === "Confirmed",
                  );

                  // Get active request for map preview
                  const activeRequest =
                    pendingRequests.find((r) => r.id === selectedRequestId) ||
                    pendingRequests[0];

                  return (
                    <div
                      key={ride.id}
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        padding: "1.5rem",
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "1.25rem",
                          borderBottom: "2px solid var(--odoo-teal)",
                          paddingBottom: "0.75rem",
                        }}
                      >
                        <div>
                          <span
                            className="odoo-badge odoo-badge-teal"
                            style={{ marginBottom: "0.5rem" }}
                          >
                            DRIVER ROLE
                          </span>
                          <h4
                            style={{
                              fontSize: "1.35rem",
                              color: "var(--odoo-violet)",
                            }}
                          >
                            {ride.pickup_location} → {ride.destination}
                          </h4>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "4px", fontSize: "0.88rem", color: "var(--text-muted)" }}>
                            <Car size={14} />
                            <span>{ride.vehicle_make}</span>
                            {ride.vehicle_license_plate && (
                              <span style={{ background: "#343a40", color: "white", borderRadius: "4px", padding: "1px 8px", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "1px" }}>
                                {ride.vehicle_license_plate}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                          {ride.status === "Open" && (
                            <button
                              className="btn btn-teal"
                              style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
                              onClick={() => handleStartRide(ride.id)}
                              disabled={loading}
                            >
                              <PlayCircle size={15} /> Start Ride
                            </button>
                          )}
                          {ride.status === "In Progress" && (
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                              {simulating[ride.id] ? (
                                <button
                                  className="btn btn-outline"
                                  style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", color: "#e67e22", borderColor: "#e67e22", display: "flex", alignItems: "center", gap: "0.4rem" }}
                                  onClick={() => stopDrivingSimulation(ride.id)}
                                >
                                  <Zap size={15} /> Stop Sim
                                </button>
                              ) : (
                                <button
                                  className="btn btn-primary"
                                  style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
                                  onClick={() => startDrivingSimulation(ride, socket)}
                                >
                                  <Zap size={15} /> Simulate Driving
                                </button>
                              )}
                            </div>
                          )}
                          <button
                            className="btn btn-outline"
                            style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
                            onClick={() => handleRideAction(ride.id, "Complete")}
                            disabled={loading}
                          >
                            Complete Ride
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", color: "#dc3545", borderColor: "#dc3545" }}
                            onClick={() => handleRideAction(ride.id, "Delete")}
                            disabled={loading}
                          >
                            Cancel Ride
                          </button>
                        </div>
                      </div>


                      <div
                        style={{
                          display: "flex",
                          gap: "2rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: "1 1 500px" }}>
                          {/* Confirmed Riders */}
                          <div style={{ marginBottom: "1.5rem" }}>
                            <h5
                              style={{
                                fontWeight: 600,
                                color: "var(--odoo-teal)",
                                marginBottom: "0.75rem",
                              }}
                            >
                              Confirmed Riders ({confirmedRiders.length})
                            </h5>
                            {confirmedRiders.length === 0 ? (
                              <p
                                style={{
                                  color: "var(--text-muted)",
                                  fontStyle: "italic",
                                  fontSize: "0.9rem",
                                }}
                              >
                                No riders confirmed yet.
                              </p>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.75rem",
                                }}
                              >
                                {confirmedRiders.map((rider) => (
                                  <div
                                    key={rider.id}
                                    style={{
                                      padding: "0.75rem 1rem",
                                      border: "1px solid #e9ecef",
                                      borderRadius: "6px",
                                      background: "#fcfcfc",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <div>
                                      <strong>{rider.passenger_name}</strong>{" "}
                                      <span
                                        style={{
                                          color: "var(--text-muted)",
                                          fontSize: "0.85rem",
                                        }}
                                      >
                                        ({rider.passenger_phone})
                                      </span>
                                      <div
                                        style={{
                                          fontSize: "0.85rem",
                                          color: "var(--text-muted)",
                                          marginTop: "4px",
                                        }}
                                      >
                                        Pickup: {rider.pickup_location}
                                      </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                      <div
                                        style={{
                                          fontWeight: 600,
                                          color: "var(--odoo-teal)",
                                        }}
                                      >
                                        ${rider.fare}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: "0.8rem",
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        {rider.seats_booked} seat(s) •{" "}
                                        {rider.distance_km} km
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Ride Requests */}
                          <div>
                            <h5
                              style={{
                                fontWeight: 600,
                                color: "#e67e22",
                                marginBottom: "0.75rem",
                              }}
                            >
                              Pending Ride Requests ({pendingRequests.length})
                            </h5>
                            {pendingRequests.length === 0 ? (
                              <p
                                style={{
                                  color: "var(--text-muted)",
                                  fontStyle: "italic",
                                  fontSize: "0.9rem",
                                }}
                              >
                                No pending requests.
                              </p>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "1rem",
                                }}
                              >
                                {pendingRequests.map((request) => (
                                  <div
                                    key={request.id}
                                    style={{
                                      padding: "1rem",
                                      border: `1px solid ${activeRequest?.id === request.id ? "#e67e22" : "#dee2e6"}`,
                                      borderRadius: "6px",
                                      background:
                                        activeRequest?.id === request.id
                                          ? "rgba(230, 126, 34, 0.03)"
                                          : "#fff",
                                      cursor: "pointer",
                                    }}
                                    onClick={() =>
                                      setSelectedRequestId(request.id)
                                    }
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                      }}
                                    >
                                      <div>
                                        <strong>
                                          {request.passenger_name}
                                        </strong>{" "}
                                        <span
                                          style={{
                                            color: "var(--text-muted)",
                                            fontSize: "0.85rem",
                                          }}
                                        >
                                          ({request.passenger_phone})
                                        </span>
                                        <div
                                          style={{
                                            fontSize: "0.85rem",
                                            color: "var(--text-muted)",
                                            marginTop: "4px",
                                          }}
                                        >
                                          Requested Pickup:{" "}
                                          <b>{request.pickup_location}</b>
                                        </div>
                                      </div>
                                      <div style={{ textAlign: "right" }}>
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: "var(--odoo-teal)",
                                            display: "block",
                                          }}
                                        >
                                          ${request.fare}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: "0.85rem",
                                            color: "var(--text-muted)",
                                          }}
                                        >
                                          {request.seats_booked} seat(s) •{" "}
                                          {request.distance_km} km
                                        </span>
                                        {requestDetours[request.id] && (
                                          <span
                                            style={{
                                              fontSize: "0.8rem",
                                              color: "#e67e22",
                                              display: "block",
                                              marginTop: "2px",
                                              fontWeight: 600,
                                            }}
                                          >
                                            Detour: +
                                            {
                                              requestDetours[request.id]
                                                .extraDistance
                                            }{" "}
                                            km
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "0.5rem",
                                        marginTop: "0.75rem",
                                      }}
                                    >
                                      <button
                                        className="btn btn-teal"
                                        style={{
                                          fontSize: "0.8rem",
                                          padding: "0.35rem 0.75rem",
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateBooking(
                                            request.id,
                                            "Confirmed",
                                          );
                                        }}
                                        disabled={loading}
                                      >
                                        <CheckCircle size={14} /> Accept
                                      </button>
                                      <button
                                        className="btn btn-outline"
                                        style={{
                                          fontSize: "0.8rem",
                                          padding: "0.35rem 0.75rem",
                                          color: "#dc3545",
                                          borderColor: "#dc3545",
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateBooking(
                                            request.id,
                                            "Declined",
                                          );
                                        }}
                                        disabled={loading}
                                      >
                                        <XCircle size={14} /> Decline
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Map Panel */}
                        <div style={{ flex: "1 1 400px", minHeight: "350px" }}>
                          <h5
                            style={{ fontWeight: 600, marginBottom: "0.75rem" }}
                          >
                            Map Route
                            {activeRequest
                              ? " (With Pending Request Detour)"
                              : " (Confirmed Route)"}
                          </h5>
                          <MapDisplay
                            startCoords={{
                              lat: parseFloat(ride.pickup_lat),
                              lon: parseFloat(ride.pickup_lon),
                            }}
                            endCoords={{
                              lat: parseFloat(ride.destination_lat),
                              lon: parseFloat(ride.destination_lon),
                            }}
                            confirmedPickups={confirmedRiders
                              .map((rider) => ({
                                lat: parseFloat(rider.pickup_lat),
                                lon: parseFloat(rider.pickup_lon),
                                passenger_name: rider.passenger_name,
                                pickup_location: rider.pickup_location,
                              }))
                              .filter((p) => p.lat && p.lon)}
                            requestCoords={
                              activeRequest
                                ? {
                                    lat: parseFloat(activeRequest.pickup_lat),
                                    lon: parseFloat(activeRequest.pickup_lon),
                                    passenger_name: activeRequest.passenger_name,
                                    pickup_location: activeRequest.pickup_location,
                                  }
                                : null
                            }
                            vehicleCoords={vehicleLiveCoords[ride.id] || null}
                            height="350px"
                          />
                          {vehicleLiveCoords[ride.id] && (
                            <div style={{ marginTop: "8px", padding: "0.6rem 1rem", background: "linear-gradient(135deg, #6c5ce7, #a29bfe)", borderRadius: "8px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>🚗 Simulation Active</span>
                              <span style={{ fontSize: "0.85rem" }}>ETA: <b>{vehicleLiveCoords[ride.id].eta}</b></span>
                            </div>
                          )}

                          {activeRequest && (
                            <small
                              style={{
                                color: "var(--text-muted)",
                                display: "block",
                                marginTop: "8px",
                                textAlign: "center",
                              }}
                            >
                              Map displays{" "}
                              <b style={{ color: "var(--odoo-violet)" }}>
                                Original Route (S → D)
                              </b>{" "}
                              and{" "}
                              <b style={{ color: "#e67e22" }}>
                                Proposed Detour (S → P → D)
                              </b>{" "}
                              for <b>{activeRequest.passenger_name}</b>.
                            </small>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* 2. Passenger Active Bookings */}
                {activePassengerRides.map((ride) => {
                  const isConfirmed = ride.booking_status === "Confirmed";

                  return (
                    <div
                      key={ride.id}
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        padding: "1.5rem",
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "1.25rem",
                          borderBottom: "2px solid var(--odoo-violet)",
                          paddingBottom: "0.75rem",
                        }}
                      >
                        <div>
                          <span
                            className={`odoo-badge ${isConfirmed ? "odoo-badge-teal" : ""}`}
                            style={{ marginBottom: "0.5rem" }}
                          >
                            {isConfirmed
                              ? "CONFIRMED CARPOOL"
                              : "PENDING APPROVAL"}
                          </span>
                          <h4
                            style={{
                              fontSize: "1.35rem",
                              color: "var(--odoo-violet)",
                            }}
                          >
                            {ride.pickup_location} → {ride.destination}
                          </h4>
                        </div>
                        <div>
                          {/* Cancel Request Button */}
                          <button
                            className="btn btn-outline"
                            style={{
                              color: "#dc3545",
                              borderColor: "#dc3545",
                              fontSize: "0.85rem",
                              padding: "0.5rem 1rem",
                            }}
                            onClick={async () => {
                              const reason = window.prompt(
                                "Please enter a reason for cancelling your ride request:",
                              );
                              if (reason === null) return;
                              setLoading(true);
                              try {
                                await updateBookingStatus(
                                  ride.booking_id,
                                  "Cancelled",
                                  reason,
                                );
                                showMsg(
                                  "Booking request cancelled successfully!",
                                );
                                loadHistory();
                              } catch (e) {
                                showMsg(e.message, true);
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={loading}
                          >
                            Cancel Request
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "2rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: "1 1 450px" }}>
                          <h5
                            style={{
                              fontWeight: 600,
                              color: "var(--odoo-violet)",
                              marginBottom: "0.75rem",
                            }}
                          >
                            Booking Information
                          </h5>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                              fontSize: "0.95rem",
                            }}
                            className="form-group"
                          >
                            <div>
                              <b>Driver Name:</b> {ride.driver_name} (
                              {ride.driver_phone || "No phone number"})
                            </div>
                            <div>
                              <b>Vehicle:</b> {ride.vehicle_make}
                              {ride.vehicle_license_plate && (
                                <span style={{ marginLeft: "8px", background: "#e9ecef", border: "1px solid #ced4da", borderRadius: "4px", padding: "2px 8px", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.5px", color: "#343a40" }}>
                                  {ride.vehicle_license_plate}
                                </span>
                              )}
                            </div>
                            <div>
                              <b>Departure:</b>{" "}
                              {new Date(
                                ride.departure_date,
                              ).toLocaleDateString()}{" "}
                              at {ride.departure_time}
                            </div>
                            <div>
                              <b>Your Pickup Spot:</b> {ride.my_pickup_location}
                            </div>
                            <div>
                              <b>Travel Distance:</b> {ride.my_distance_km} km
                            </div>
                            <div>
                              <b>Seats Reserved:</b> {ride.seats_booked} seat(s)
                            </div>

                            <div
                              style={{
                                background: "#f8f9fa",
                                padding: "1rem",
                                borderRadius: "6px",
                                marginTop: "0.5rem",
                                borderLeft: "4px solid var(--odoo-teal)",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontWeight: 700,
                                  color: "var(--odoo-teal)",
                                }}
                              >
                                <span>Estimated Payment to Done:</span>
                                <span>${ride.my_fare}</span>
                              </div>
                              <small
                                style={{
                                  color: "var(--text-muted)",
                                  display: "block",
                                  marginTop: "4px",
                                }}
                              >
                                Calculated as: distance ({ride.my_distance_km}{" "}
                                km) * cost per seat per km ($
                                {ride.fare_per_seat}) * seats (
                                {ride.seats_booked})
                              </small>
                            </div>
                          </div>

                          {/* Other passengers */}
                          {isConfirmed && (
                            <div style={{ marginTop: "1.25rem" }}>
                              <h6
                                style={{
                                  fontWeight: 600,
                                  marginBottom: "0.5rem",
                                }}
                              >
                                Other Confirmed Passenger(s) sharing this ride:
                              </h6>
                              {ride.other_riders &&
                              ride.other_riders.length > 0 ? (
                                <ul
                                  style={{
                                    listStyleType: "disc",
                                    paddingLeft: "1.25rem",
                                    fontSize: "0.9rem",
                                  }}
                                >
                                  {ride.other_riders.map((r, i) => (
                                    <li key={i}>
                                      {r.passenger_name} ({r.seats_booked}{" "}
                                      seats)
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p
                                  style={{
                                    fontSize: "0.9rem",
                                    color: "var(--text-muted)",
                                    fontStyle: "italic",
                                  }}
                                >
                                  No other passengers confirmed yet.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Map Panel */}
                        <div style={{ flex: "1 1 350px", minHeight: "300px" }}>
                          <h5
                            style={{ fontWeight: 600, marginBottom: "0.75rem" }}
                          >
                            Route Map
                          </h5>
                          <MapDisplay
                            startCoords={{
                              lat: parseFloat(ride.pickup_lat),
                              lon: parseFloat(ride.pickup_lon),
                            }}
                            endCoords={{
                              lat: parseFloat(ride.destination_lat),
                              lon: parseFloat(ride.destination_lon),
                            }}
                            confirmedPickups={[
                              ...(ride.other_riders || []).map((r) => ({
                                lat: parseFloat(r.pickup_lat),
                                lon: parseFloat(r.pickup_lon),
                                passenger_name: r.passenger_name,
                                pickup_location: r.pickup_location,
                              })),
                              isConfirmed
                                ? {
                                    lat: parseFloat(ride.my_pickup_lat),
                                    lon: parseFloat(ride.my_pickup_lon),
                                    passenger_name: "You",
                                    pickup_location: ride.my_pickup_location,
                                  }
                                : null,
                            ].filter((p) => p && p.lat && p.lon)}
                            requestCoords={
                              !isConfirmed
                                ? {
                                    lat: parseFloat(ride.my_pickup_lat),
                                    lon: parseFloat(ride.my_pickup_lon),
                                    passenger_name: "You (Pending Request)",
                                    pickup_location: ride.my_pickup_location,
                                  }
                                : null
                            }
                            vehicleCoords={vehicleLiveCoords[ride.id] || null}
                            height="300px"
                          />
                          {ride.status === "In Progress" && (
                            <div style={{ marginTop: "8px", padding: "0.65rem 1rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", background: vehicleLiveCoords[ride.id] ? "linear-gradient(135deg, #6c5ce7, #a29bfe)" : "#f1f3f5", color: vehicleLiveCoords[ride.id] ? "white" : "var(--text-muted)", fontSize: "0.85rem" }}>
                              <span style={{ fontWeight: 600 }}>
                                {vehicleLiveCoords[ride.id] ? "🚗 Driver is on the way" : "⏳ Waiting for driver to start simulation..."}
                              </span>
                              {vehicleLiveCoords[ride.id] && (
                                <span>ETA: <b>{vehicleLiveCoords[ride.id].eta}</b></span>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Offer Ride Tab */}
        {activeTab === "offer" && (
          <div>
            <h3 style={{ marginBottom: "1.5rem", color: "var(--odoo-teal)" }}>
              Publish a New Ride
            </h3>
            {vehicles.length === 0 ? (
              <div
                style={{
                  padding: "2rem",
                  textAlign: "center",
                  background: "#f8f9fa",
                  borderRadius: "8px",
                }}
              >
                <Car
                  size={32}
                  color="var(--text-muted)"
                  style={{ margin: "0 auto 1rem" }}
                />
                <p>You need to add a vehicle before you can offer a ride.</p>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: "1rem" }}
                  onClick={() => setActiveTab("vehicles")}
                >
                  Go to My Vehicles
                </button>
              </div>
            ) : (
              <form onSubmit={handleOfferRide}>
                <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                  {/* Form fields */}
                  <div style={{ flex: "1 1 500px" }}>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Pickup Location</label>
                        <LocationAutocomplete
                          value={offerForm.pickupLocation}
                          onChange={(val, item) =>
                            setOfferForm({
                              ...offerForm,
                              pickupLocation: val,
                              pickupLat: item ? parseFloat(item.lat) : null,
                              pickupLon: item ? parseFloat(item.lon) : null,
                            })
                          }
                          placeholder="Search pickup location..."
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Destination</label>
                        <LocationAutocomplete
                          value={offerForm.destination}
                          onChange={(val, item) =>
                            setOfferForm({
                              ...offerForm,
                              destination: val,
                              destinationLat: item
                                ? parseFloat(item.lat)
                                : null,
                              destinationLon: item
                                ? parseFloat(item.lon)
                                : null,
                            })
                          }
                          placeholder="Search destination..."
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Date</label>
                        <input
                          type="date"
                          className="form-control"
                          required
                          min={new Date().toISOString().split("T")[0]}
                          value={offerForm.departureDate}
                          onChange={(e) =>
                            setOfferForm({
                              ...offerForm,
                              departureDate: e.target.value,
                              // reset time if date changed to today so stale past time can't persist
                              departureTime:
                                e.target.value === new Date().toISOString().split("T")[0]
                                  ? ""
                                  : offerForm.departureTime,
                            })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Time</label>
                        <input
                          type="time"
                          className="form-control"
                          required
                          min={
                            offerForm.departureDate === new Date().toISOString().split("T")[0]
                              ? new Date().toTimeString().slice(0, 5)
                              : undefined
                          }
                          value={offerForm.departureTime}
                          onChange={(e) =>
                            setOfferForm({
                              ...offerForm,
                              departureTime: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Select Vehicle</label>
                        <select
                          className="form-select"
                          required
                          value={offerForm.vehicleId}
                          onChange={(e) =>
                            setOfferForm({
                              ...offerForm,
                              vehicleId: e.target.value,
                            })
                          }
                        >
                          <option value="">-- Choose Vehicle --</option>
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.make_model} ({v.license_plate})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label">Seats</label>
                          <input
                            type="number"
                            min="1"
                            max={
                              vehicles.find((v) => v.id === offerForm.vehicleId)
                                ?.capacity || 10
                            }
                            className="form-control"
                            required
                            value={offerForm.availableSeats}
                            onChange={(e) =>
                              setOfferForm({
                                ...offerForm,
                                availableSeats: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Cost per km ($)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            required
                            value={offerForm.farePerSeat}
                            onChange={(e) =>
                              setOfferForm({
                                ...offerForm,
                                farePerSeat: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="btn btn-teal"
                      style={{ marginTop: "1rem", width: "100%" }}
                      disabled={loading}
                    >
                      Publish Ride
                    </button>
                  </div>

                  {/* Route preview map */}
                  <div style={{ flex: "1 1 400px", minHeight: "380px" }}>
                    <h4
                      style={{
                        marginBottom: "1rem",
                        color: "var(--text-main)",
                      }}
                    >
                      Route Map Preview
                    </h4>
                    <MapDisplay
                      startCoords={
                        offerForm.pickupLat
                          ? {
                              lat: offerForm.pickupLat,
                              lon: offerForm.pickupLon,
                            }
                          : null
                      }
                      endCoords={
                        offerForm.destinationLat
                          ? {
                              lat: offerForm.destinationLat,
                              lon: offerForm.destinationLon,
                            }
                          : null
                      }
                      height="380px"
                    />
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Ride History Tab */}
        {activeTab === "history" && (
          <div>
            <h3 style={{ marginBottom: "1.5rem" }}>My Ride History</h3>
            {rideHistory.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No past rides found.</p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {rideHistory.map((ride) => (
                  <div
                    key={ride.id}
                    style={{
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "1rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <strong style={{ fontSize: "1.1rem" }}>
                          {ride.pickup_location} → {ride.destination}
                        </strong>
                        <span
                          className={`odoo-badge ${ride.user_role === "Driver" ? "odoo-badge-teal" : ""}`}
                        >
                          {ride.user_role}
                        </span>
                        <span
                          className="odoo-badge"
                          style={{ background: "#e9ecef", color: "#495057" }}
                        >
                          {ride.status}{" "}
                          {ride.cancellation_reason &&
                            `(Reason: ${ride.cancellation_reason})`}
                        </span>
                        {ride.user_role === "Passenger" && (
                          <span
                            className={`odoo-badge ${ride.booking_status === "Confirmed" ? "odoo-badge-teal" : ""}`}
                            style={{
                              background:
                                ride.booking_status === "Declined" ||
                                ride.booking_status === "Cancelled"
                                  ? "#f8d7da"
                                  : "",
                              color:
                                ride.booking_status === "Declined" ||
                                ride.booking_status === "Cancelled"
                                  ? "#721c24"
                                  : "",
                            }}
                          >
                            {ride.booking_status}{" "}
                            {ride.cancellation_reason &&
                              `(Reason: ${ride.cancellation_reason})`}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {new Date(ride.departure_date).toLocaleDateString()} at{" "}
                        {ride.departure_time} |
                        {ride.user_role === "Passenger"
                          ? ` Driver: ${ride.driver_name} | 🚗 ${ride.vehicle_make}${ride.vehicle_license_plate ? ` [${ride.vehicle_license_plate}]` : ""}`
                          : ` 🚗 ${ride.vehicle_make}${ride.vehicle_license_plate ? ` [${ride.vehicle_license_plate}]` : ""}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="btn btn-outline"
                        style={{
                          fontSize: "0.85rem",
                          padding: "0.5rem 1rem",
                        }}
                        onClick={() => setSelectedHistoryRide(ride)}
                      >
                        Details
                      </button>
                      {((ride.user_role === "Driver" &&
                        (ride.status === "Open" ||
                          ride.status === "In Progress")) ||
                        (ride.user_role === "Passenger" &&
                          ride.booking_status === "Confirmed" &&
                          (ride.status === "Open" ||
                            ride.status === "In Progress"))) && (
                        <button
                          className="btn btn-teal"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.85rem",
                            padding: "0.5rem 1rem",
                          }}
                          onClick={() => handleOpenCommHub(ride)}
                        >
                          Communicate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Ride Details Modal */}
            {selectedHistoryRide && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0, 0, 0, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1050,
                }}
              >
                <div
                  className="odoo-card"
                  style={{
                    width: "500px",
                    maxWidth: "90%",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    padding: "2rem",
                    borderRadius: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                    <h4 style={{ margin: 0, color: "var(--odoo-violet)" }}>Ride Details</h4>
                    <button className="btn btn-outline" style={{ padding: "0.2rem 0.5rem" }} onClick={() => setSelectedHistoryRide(null)}>X</button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.95rem" }}>
                    {selectedHistoryRide.user_role === "Passenger" && (
                      <div><b>Driver Name:</b> {selectedHistoryRide.driver_name}</div>
                    )}
                    <div><b>Vehicle:</b> {selectedHistoryRide.vehicle_make} {selectedHistoryRide.vehicle_license_plate ? `[${selectedHistoryRide.vehicle_license_plate}]` : ""}</div>
                    <div><b>Pickup Point:</b> {selectedHistoryRide.my_pickup_location || selectedHistoryRide.pickup_location}</div>
                    <div><b>Destination Point:</b> {selectedHistoryRide.destination}</div>
                    {selectedHistoryRide.user_role === "Passenger" && selectedHistoryRide.my_distance_km && (
                      <div><b>Distance:</b> {selectedHistoryRide.my_distance_km} km</div>
                    )}
                    <div><b>Date & Time:</b> {new Date(selectedHistoryRide.departure_date).toLocaleDateString()} at {selectedHistoryRide.departure_time}</div>
                    <div><b>Per Seat Charge:</b> ${Number(selectedHistoryRide.fare_per_seat).toFixed(2)}</div>
                    
                    <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border-color)" }}>
                      <b>Total Charge:</b> 
                      <span style={{ marginLeft: "0.5rem", color: "var(--odoo-teal)", fontWeight: 800, fontSize: "1.1rem" }}>
                        ${selectedHistoryRide.user_role === "Passenger" 
                          ? Number(selectedHistoryRide.my_fare).toFixed(2)
                          : (Number(selectedHistoryRide.fare_per_seat) * (selectedHistoryRide.bookings ? selectedHistoryRide.bookings.reduce((sum, b) => sum + b.seats_booked, 0) : 0)).toFixed(2)}
                      </span>
                    </div>

                    {selectedHistoryRide.user_role === "Passenger" && selectedHistoryRide.payment_status && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <b>Payment Status:</b> 
                        <span style={{ 
                          marginLeft: "0.5rem", 
                          padding: "2px 8px", 
                          borderRadius: "4px",
                          background: selectedHistoryRide.payment_status === "Paid" ? "#d4edda" : "#f8d7da",
                          color: selectedHistoryRide.payment_status === "Paid" ? "#155724" : "#721c24",
                          fontWeight: "bold"
                        }}>
                          {selectedHistoryRide.payment_status}
                        </span>
                      </div>
                    )}

                    {selectedHistoryRide.user_role === "Passenger" && 
                     selectedHistoryRide.payment_status === "Unpaid" && 
                     (selectedHistoryRide.status === "Completed" || selectedHistoryRide.status === "In Progress" || selectedHistoryRide.booking_status === "Confirmed") && (
                      <button 
                        className="btn btn-primary" 
                        style={{ marginTop: "1rem", padding: "0.75rem", width: "100%", fontWeight: "bold" }}
                        onClick={() => {
                          // The `unpaidBookings` is loaded from wallet backend, which returns `booking_id`, `fare`, etc.
                          // But we can just use `selectedHistoryRide` if it has everything needed for payment processing.
                          // The Payment tab expects an object with `booking_id`, `fare`, `pickup_location`, `destination`, `driver_name`.
                          // `selectedHistoryRide` has all these.
                          setSelectedPayBooking(selectedHistoryRide);
                          setSelectedHistoryRide(null);
                          setActiveTab("payment");
                        }}
                      >
                        Pay Now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add Vehicle Tab */}
        {activeTab === "vehicles" && (
          <div>
            <h3 style={{ marginBottom: "1.5rem" }}>My Registered Vehicles</h3>
            <div className="grid-2">
              <div>
                <form
                  onSubmit={handleAddVehicle}
                  style={{
                    background: "#f8f9fa",
                    padding: "1.5rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <h4 style={{ marginBottom: "1rem" }}>Add New Vehicle</h4>
                  <div className="form-group">
                    <label className="form-label">Make & Model</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="e.g. Toyota Prius"
                      value={newVehicle.makeModel}
                      onChange={(e) =>
                        setNewVehicle({
                          ...newVehicle,
                          makeModel: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">License Plate</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="e.g. ABC-1234"
                      value={newVehicle.licensePlate}
                      onChange={(e) =>
                        setNewVehicle({
                          ...newVehicle,
                          licensePlate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Seat Capacity</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="form-control"
                      required
                      value={newVehicle.capacity}
                      onChange={(e) =>
                        setNewVehicle({
                          ...newVehicle,
                          capacity: e.target.value,
                        })
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    <Plus size={16} /> Register Vehicle
                  </button>
                </form>
              </div>
              <div>
                {vehicles.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", marginTop: "1rem" }}>
                    No vehicles registered yet.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    {vehicles.map((v) => (
                      <div
                        key={v.id}
                        style={{
                          border: "1px solid var(--border-color)",
                          borderRadius: "6px",
                          padding: "1rem",
                          background: "#fff",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontWeight: 600,
                          }}
                        >
                          <Car size={18} color="var(--odoo-violet)" />{" "}
                          {v.make_model}
                        </div>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--text-muted)",
                            marginTop: "0.25rem",
                          }}
                        >
                          Plate: {v.license_plate} | Capacity: {v.capacity}{" "}
                          seats
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========== WALLET TAB ========== */}
        {activeTab === "wallet" && (
          <div>
            <h3 style={{ marginBottom: "1.5rem", color: "var(--odoo-violet)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Wallet size={24} /> My Wallet
            </h3>

            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              {/* Balance Card */}
              <div style={{ flex: "1 1 300px" }}>
                <div style={{ background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)", borderRadius: "16px", padding: "2rem", color: "white", marginBottom: "1.5rem", boxShadow: "0 8px 32px rgba(108,92,231,0.35)", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
                  <div style={{ position: "absolute", bottom: "-20px", left: "60px", width: "80px", height: "80px", borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
                  <div style={{ fontSize: "0.85rem", opacity: 0.85, marginBottom: "0.5rem", fontWeight: 500 }}>Available Balance</div>
                  <div style={{ fontSize: "2.8rem", fontWeight: 800, letterSpacing: "-1px" }}>${walletBalance.toFixed(2)}</div>
                  <div style={{ marginTop: "1rem", fontSize: "0.8rem", opacity: 0.7 }}>EcoDrive Wallet • {user?.fullName}</div>
                </div>

                {/* Quick Recharge */}
                <div style={{ background: "white", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "1.5rem" }}>
                  <h5 style={{ marginBottom: "1rem", fontWeight: 700, color: "var(--odoo-violet)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <ArrowUpCircle size={18} /> Recharge Wallet
                  </h5>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                    {[10, 25, 50, 100].map(amt => (
                      <button key={amt} className="btn btn-outline" style={{ flex: "1 1 60px", padding: "0.5rem", fontWeight: 700, fontSize: "0.95rem" }} onClick={() => handleRechargeWallet(amt)} disabled={walletLoading}>
                        ${amt}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Custom amount..."
                      min="1"
                      step="0.01"
                      value={rechargeAmount}
                      onChange={e => setRechargeAmount(e.target.value)}
                      style={{ flex: 1, borderRadius: "8px" }}
                    />
                    <button className="btn btn-primary" style={{ whiteSpace: "nowrap", padding: "0.5rem 1.25rem", borderRadius: "8px", display: "flex", alignItems: "center", gap: "0.4rem" }} onClick={() => handleRechargeWallet(rechargeAmount)} disabled={walletLoading || !rechargeAmount}>
                      <ArrowUpCircle size={15} /> {walletLoading ? "..." : "Recharge"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Transaction History */}
              <div style={{ flex: "2 1 400px" }}>
                <div style={{ background: "white", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "1.5rem" }}>
                  <h5 style={{ marginBottom: "1rem", fontWeight: 700, color: "var(--odoo-teal)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <TrendingUp size={18} /> Transaction History
                  </h5>
                  {walletTransactions.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "2rem" }}>No transactions yet. Recharge your wallet to get started!</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "400px", overflowY: "auto" }}>
                      {walletTransactions.map(tx => {
                        const isPositive = tx.amount > 0;
                        return (
                          <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1rem", borderRadius: "8px", background: isPositive ? "#f0fff4" : "#fff5f5", border: `1px solid ${isPositive ? "#b2f2bb" : "#ffc9c9"}` }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: isPositive ? "#2b8a3e" : "#c92a2a" }}>
                                {tx.type === "Recharge" ? "💰" : tx.type === "Received" ? "✅" : "💳"} {tx.type}
                              </div>
                              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>{tx.description}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>{new Date(tx.created_at).toLocaleString()}</div>
                            </div>
                            <div style={{ fontWeight: 800, fontSize: "1.1rem", color: isPositive ? "#2b8a3e" : "#c92a2a" }}>
                              {isPositive ? "+" : ""}{Number(tx.amount).toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== PAYMENT TAB ========== */}
        {activeTab === "payment" && (
          <div>
            <h3 style={{ marginBottom: "1.5rem", color: "var(--odoo-violet)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ReceiptText size={24} /> Payments
            </h3>

            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              {/* Unpaid Bookings List */}
              <div style={{ flex: "1 1 340px" }}>
                <div style={{ background: "white", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "1.5rem" }}>
                  <h5 style={{ marginBottom: "1rem", fontWeight: 700, color: "#495057" }}>Rides Awaiting Payment</h5>
                  {unpaidBookings.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                      <CheckCircle2 size={40} color="#2b8a3e" style={{ margin: "0 auto 1rem" }} />
                      <p style={{ color: "var(--text-muted)" }}>All your rides are paid up! 🎉</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {unpaidBookings.map(b => (
                        <div
                          key={b.booking_id}
                          onClick={() => setSelectedPayBooking(b)}
                          style={{ padding: "1rem", borderRadius: "10px", border: `2px solid ${selectedPayBooking?.booking_id === b.booking_id ? "var(--odoo-violet)" : "var(--border-color)"}`, background: selectedPayBooking?.booking_id === b.booking_id ? "#f3f0ff" : "#fafafa", cursor: "pointer", transition: "all 0.2s" }}
                        >
                          <div style={{ fontWeight: 700, color: "var(--odoo-violet)", fontSize: "0.95rem" }}>
                            {b.pickup_location} → {b.destination}
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            Driver: {b.driver_name} • {new Date(b.departure_date).toLocaleDateString()}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{b.seats_booked} seat(s)</span>
                            <span style={{ fontWeight: 800, color: "var(--odoo-teal)", fontSize: "1rem" }}>${Number(b.fare).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Checkout */}
              <div style={{ flex: "1 1 340px" }}>
                {selectedPayBooking ? (
                  <div style={{ background: "white", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "1.5rem" }}>
                    <h5 style={{ marginBottom: "1.25rem", fontWeight: 700, color: "var(--odoo-violet)" }}>Checkout</h5>

                    {/* Selected ride summary */}
                    <div style={{ background: "#f8f9fa", borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem", borderLeft: "4px solid var(--odoo-violet)" }}>
                      <div style={{ fontWeight: 700 }}>{selectedPayBooking.pickup_location} → {selectedPayBooking.destination}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>Driver: {selectedPayBooking.driver_name}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontWeight: 800 }}>
                        <span>Amount Due</span>
                        <span style={{ color: "var(--odoo-teal)", fontSize: "1.2rem" }}>${Number(selectedPayBooking.fare).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Payment Method */}
                    <label style={{ fontWeight: 600, marginBottom: "0.5rem", display: "block" }}>Select Payment Method</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1.25rem" }}>
                      {["Cash", "Card", "UPI", "Wallet"].map(m => (
                        <button
                          key={m}
                          onClick={() => setPaymentMethod(m)}
                          style={{ padding: "0.75rem", borderRadius: "10px", border: `2px solid ${paymentMethod === m ? "var(--odoo-violet)" : "var(--border-color)"}`, background: paymentMethod === m ? "#f3f0ff" : "white", fontWeight: 600, color: paymentMethod === m ? "var(--odoo-violet)" : "#495057", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
                        >
                          {m === "Cash" && "💵"}{m === "Card" && "💳"}{m === "UPI" && "📱"}{m === "Wallet" && "👛"} {m}
                        </button>
                      ))}
                    </div>

                    {/* Wallet balance info */}
                    {paymentMethod === "Wallet" && (
                      <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: "8px", background: walletBalance >= Number(selectedPayBooking.fare) ? "#f0fff4" : "#fff5f5", border: `1px solid ${walletBalance >= Number(selectedPayBooking.fare) ? "#b2f2bb" : "#ffc9c9"}`, fontSize: "0.88rem" }}>
                        <div style={{ fontWeight: 600, color: walletBalance >= Number(selectedPayBooking.fare) ? "#2b8a3e" : "#c92a2a" }}>
                          {walletBalance >= Number(selectedPayBooking.fare)
                            ? `✅ Sufficient balance ($${walletBalance.toFixed(2)} available)`
                            : `❌ Insufficient balance ($${walletBalance.toFixed(2)} available, need $${Number(selectedPayBooking.fare).toFixed(2)})`}
                        </div>
                        {walletBalance < Number(selectedPayBooking.fare) && (
                          <button className="btn btn-outline" style={{ marginTop: "0.5rem", fontSize: "0.8rem", padding: "0.35rem 0.75rem" }} onClick={() => setActiveTab("wallet")}>
                            Top up wallet →
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      style={{ width: "100%", padding: "0.85rem", borderRadius: "10px", fontWeight: 700, fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                      onClick={handlePayBooking}
                      disabled={paymentLoading || (paymentMethod === "Wallet" && walletBalance < Number(selectedPayBooking.fare))}
                    >
                      <CreditCard size={18} /> {paymentLoading ? "Processing..." : `Pay $${Number(selectedPayBooking.fare).toFixed(2)} via ${paymentMethod}`}
                    </button>
                    <button className="btn btn-outline" style={{ width: "100%", marginTop: "0.5rem", padding: "0.6rem" }} onClick={() => setSelectedPayBooking(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ background: "#f8f9fa", borderRadius: "12px", padding: "3rem 2rem", textAlign: "center" }}>
                    <CreditCard size={48} color="var(--text-muted)" style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
                    <h5 style={{ color: "var(--text-muted)" }}>Select a ride to pay</h5>
                    <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Click on a ride from the list on the left to proceed with payment.</p>

                    {/* Wallet Balance Mini-Widget */}
                    <div style={{ marginTop: "1.5rem", padding: "1rem", background: "linear-gradient(135deg, #6c5ce7, #a29bfe)", borderRadius: "10px", color: "white" }}>
                      <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>Your Wallet Balance</div>
                      <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>${walletBalance.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* COMM HUB OVERLAY DRAWER */}

        {activeCommRide && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.4)",
              zIndex: 1100,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <div
              className="odoo-card"
              style={{
                width: "450px",
                height: "100%",
                borderRadius: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                padding: "1.5rem",
                boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
                boxSizing: "border-box",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid var(--border-color)",
                  paddingBottom: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, color: "var(--odoo-violet)" }}>
                    💬 Comm Hub
                  </h3>
                  <span
                    style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                  >
                    {activeCommRide.pickup_location} →{" "}
                    {activeCommRide.destination}
                  </span>
                </div>
                <button
                  className="btn btn-outline"
                  style={{ padding: "0.3rem 0.6rem" }}
                  onClick={handleCloseCommHub}
                >
                  Close
                </button>
              </div>

              {/* Live Indicator */}
              <div
                style={{
                  background: "#eafaf1",
                  color: "#2b8a3e",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "1rem",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    background: "#2b8a3e",
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                ></span>
                Connected to Ride Room
              </div>

              {/* LIVE VOICE CALL INTERFACE */}
              <div style={{
                background: isInVoiceCall ? "linear-gradient(135deg, #e7f5ff 0%, #d0ebff 100%)" : "#f1f3f5",
                border: isInVoiceCall ? "1px solid #a5d8ff" : "1px solid #e9ecef",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                boxSizing: "border-box"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: isInVoiceCall ? "#1971c2" : "#495057" }}>
                    {isInVoiceCall ? "📞 Live Voice Call Active" : "🔇 Not in Voice Call"}
                  </span>
                  {isInVoiceCall && (
                    <span style={{
                      background: isMuted ? "#f1f3f5" : "#37b24d",
                      color: isMuted ? "#495057" : "white",
                      fontSize: "0.7rem",
                      padding: "2px 6px",
                      borderRadius: "10px",
                      fontWeight: "bold"
                    }}>
                      {isMuted ? "MUTED" : "SPEAKING"}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {!isInVoiceCall ? (
                    <button 
                      className="btn btn-teal" 
                      style={{ flex: 1, padding: "0.6rem", fontSize: "0.85rem" }}
                      onClick={handleJoinVoiceCall}
                    >
                      🔊 Join Voice Call
                    </button>
                  ) : (
                    <>
                      <button 
                        className="btn btn-outline" 
                        style={{ 
                          flex: 1, 
                          padding: "0.6rem", 
                          fontSize: "0.85rem",
                          color: isMuted ? "#37b24d" : "#e67e22",
                          borderColor: isMuted ? "#37b24d" : "#e67e22"
                        }}
                        onClick={handleToggleMute}
                      >
                        {isMuted ? "🎙️ Unmute Mic" : "🔇 Mute Mic"}
                      </button>
                      <button 
                        className="btn" 
                        style={{ 
                          flex: 1, 
                          padding: "0.6rem", 
                          fontSize: "0.85rem",
                          background: "#fa5252",
                          color: "white",
                          border: "none"
                        }}
                        onClick={handleLeaveVoiceCall}
                      >
                        🔴 Leave Call
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Chat Area */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  background: "#f8f9fa",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  padding: "1rem",
                  marginBottom: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {chatMessages.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      color: "var(--text-muted)",
                      marginTop: "2rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    No messages yet. Send a text or use Push-to-Talk to speak!
                  </div>
                ) : (
                  chatMessages.map((msg, index) => {
                    const isMe =
                      msg.senderId === user.id || msg.senderName === "You";
                    return (
                      <div
                        key={msg.id || index}
                        style={{
                          alignSelf: isMe ? "flex-end" : "flex-start",
                          maxWidth: "85%",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            marginBottom: "2px",
                            textAlign: isMe ? "right" : "left",
                          }}
                        >
                          {msg.senderName} • {msg.timestamp}
                        </div>
                        <div
                          style={{
                            background: isMe ? "var(--odoo-violet)" : "white",
                            color: isMe ? "white" : "black",
                            padding: "0.65rem 0.85rem",
                            borderRadius: "12px",
                            borderTopRightRadius: isMe ? "2px" : "12px",
                            borderTopLeftRadius: isMe ? "12px" : "2px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                            border: isMe ? "none" : "1px solid #dee2e6",
                          }}
                        >
                          {msg.isVoice ? (
                            <button
                              onClick={() => playVoiceNote(msg.audioBase64)}
                              style={{
                                background: "none",
                                border: "none",
                                color: isMe ? "white" : "var(--odoo-violet)",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                cursor: "pointer",
                                fontWeight: 600,
                                padding: 0,
                              }}
                            >
                              Play Voice Note
                            </button>
                          ) : (
                            msg.message
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input & Record Form */}
              <div>
                {/* Push to talk voice chat */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                    }}
                  >
                    Live Voice Chat (Push-to-Talk)
                  </span>
                  <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    style={{
                      width: "100%",
                      padding: "0.85rem",
                      background: isRecording ? "#dc3545" : "#2b8a3e",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      cursor: "pointer",
                      userSelect: "none",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                    }}
                  >
                    {isRecording
                      ? "Speaking... Release to Send"
                      : "🎤 Hold to Speak (PTT)"}
                  </button>
                </div>

                {/* Text Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newMessage.trim() || !socket || !activeCommRide)
                      return;
                    socket.emit("send_message", {
                      rideId: activeCommRide.id,
                      message: newMessage,
                      senderId: user.id,
                      senderName: user.fullName,
                    });
                    setNewMessage("");
                  }}
                  style={{ display: "flex", gap: "0.5rem" }}
                >
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    style={{ borderRadius: "8px" }}
                  />
                  <button
                    type="submit"
                    className="btn btn-teal"
                    style={{ padding: "0 1.25rem", borderRadius: "8px" }}
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
