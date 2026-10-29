import { useState } from "react";
import AcuityScreen from "../acuity/AcuityScreen";
import { DistanceSetup } from "./DistanceSetup";

/** Distance capture unmounts before the test can start its own camera. */
export default function AcuityEntry() {
  const [proceed, setProceed] = useState(false);
  return proceed ? <AcuityScreen /> : <DistanceSetup onContinue={() => setProceed(true)} />;
}
