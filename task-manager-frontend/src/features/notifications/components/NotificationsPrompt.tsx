import { useEffect, useState } from "react";

import {
  checkSubscriptionStatus,
  ensureServiceWorker,
  registerAndSubscribe,
} from "../utils";
import useSubscribe from "../hooks/useSubscribe";

export default function NotificationsPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const { mutateAsync: subscribe } = useSubscribe();

  useEffect(() => {
    const initialiseNotifications = async () => {
      try {
        await ensureServiceWorker();
        const isSubscribed = await checkSubscriptionStatus();
        setShowPrompt(!isSubscribed);
      } catch (error) {
        console.error("Failed to initialise notification checks:", error);
      }
    };

    initialiseNotifications();
  }, []);

  if (!showPrompt) {
    return null;
  }

  const handleSubscribe = async () => {
    try {
      const subscriptionData = await registerAndSubscribe();
      await subscribe(subscriptionData);
      console.log("Successfully subscribed to notifications.");
      // TODO: get toast
      setShowPrompt(false);
    } catch {
      console.error("Could not subscribe.");
    }
  };

  return (
    <div className="card p-4 fixed top-4 right-4 z-50">
      <header className="text-sm font-bold mb-2">
        <h1 className="w-max">Want notifications?</h1>
      </header>
      <div className="flex gap-4 text-xs">
        <button className="btn-primary" onClick={handleSubscribe}>
          Subscribe
        </button>
        <button className="btn-secondary" onClick={() => setShowPrompt(false)}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
