// servicepage/rebar.tsx

"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, ShoppingCart, Zap } from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import {
  useRebarTemplates,
  RebarDimension,
} from "@/lib/hooks/useRebarTemplates";
import { useCalculateRebar } from "@/lib/hooks/useCalculation";
import { useAddToCart } from "@/lib/hooks/useAddToCart";
import {
  CalculateRebarResponse,
  CalculateRebarPayload,
} from "@/lib/services/calculationService";
import { getOrCreateGuestId } from "@/lib/guestId";
import { toast } from "sonner";
import Link from "next/link";

const Rebar = () => {
  // Fetch templates using custom hook
  const { data: templates = [], isLoading } = useRebarTemplates();

  const [calculationResult, setCalculationResult] =
    useState<CalculateRebarResponse | null>(null);
  const { mutate: calculateRebar } = useCalculateRebar();

  // State for user selections
  // Initial state might need to wait for data, but we can set defaults.
  // We'll sync with useEffect when data loads.
  const [selectedShapeId, setSelectedShapeId] = useState<string>("");
  const selectedTemplate = templates.find((t) => t._id === selectedShapeId);
  const [thickness, setThickness] = useState("6");
  const [material, setMaterial] = useState("");
  const [dimensions, setDimensions] = useState<{ [key: string]: number }>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [quantity, setQuantity] = useState(1);
  const { data: session } = useSession();
  const token = session?.accessToken || "";

  const { mutate: addToCart } = useAddToCart({ token });

  const handleCalculate = React.useCallback(
    (
      currentQuantity: number = quantity,
      currentDimensions: { [key: string]: number } = dimensions,
      currentThickness: string = thickness,
    ) => {
      if (!selectedTemplate) return;

      const payload: CalculateRebarPayload = {
        shapeName: selectedTemplate.shapeName,
        diameter: Number(currentThickness),
        units: currentQuantity,
      };

      selectedTemplate.dimensions.forEach((dim, index) => {
        const letter = String.fromCodePoint(65 + index); // 65 is 'A'
        payload[`size${letter}`] = currentDimensions[dim.key] || 0;
      });

      calculateRebar(payload, {
        onSuccess: (data) => {
          setCalculationResult(data);
        },
      });
    },
    [selectedTemplate, calculateRebar, quantity, dimensions, thickness],
  );

  // Set default selection when templates load
  useEffect(() => {
    if (templates.length > 0 && !selectedShapeId) {
      const firstTemplate = templates[0];

      // Make optimization to avoid synchronous setState warning
      void Promise.resolve().then(() => {
        setSelectedShapeId(firstTemplate._id);
        setThickness(String(firstTemplate.availableDiameters[0]));

        if (firstTemplate.materials?.length > 0) {
          setMaterial(firstTemplate.materials[0].material);
        }

        const initialDims: { [key: string]: number } = {};
        firstTemplate.dimensions.forEach((dim: RebarDimension) => {
          initialDims[dim.key] = dim.minRange;
        });
        setDimensions(initialDims);
        handleCalculate(
          quantity,
          initialDims,
          String(firstTemplate.availableDiameters[0]),
        );
      });
    }
  }, [templates, selectedShapeId, handleCalculate, quantity]);

  const handleShapeSelect = (templateId: string) => {
    const template = templates.find((t) => t._id === templateId);
    if (!template) return;

    setSelectedShapeId(templateId);

    // Reset dimensions to min ranges
    const newDims: { [key: string]: number } = {};
    template.dimensions.forEach((dim) => {
      newDims[dim.key] = dim.minRange;
    });
    setDimensions(newDims);
    setErrors({});

    // Reset thickness if current is not available?
    // Or pick nearest? For now select first available if current invalid.
    if (!template.availableDiameters.includes(Number(thickness))) {
      setThickness(String(template.availableDiameters[0] || "6"));
    }

    if (template.materials?.length > 0) {
      const exists = template.materials.some((m) => m.material === material);
      if (!exists) {
        setMaterial(template.materials[0].material);
      }
    }

    handleCalculate(quantity, newDims, thickness);
  };

  const handleDimensionChange = (key: string, valueStr: string) => {
    const value = Number.parseInt(valueStr) || 0;
    const dimensionConfig = selectedTemplate?.dimensions.find(
      (d) => d.key === key,
    );

    if (!dimensionConfig) return;

    const min = dimensionConfig.minRange;
    const max = dimensionConfig.maxRange;

    let error = "";
    if (value < min) {
      error = `Min value is ${min}`;
    } else if (value > max) {
      error = `Max value is ${max}`;
    }

    setErrors((prev) => ({ ...prev, [key]: error }));
    const nextDimensions = { ...dimensions, [key]: value };
    setDimensions(nextDimensions);

    if (!error) {
      handleCalculate(quantity, nextDimensions, thickness);
    }
  };


  const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);


  const handleAddToCart = () => {
    if (!calculationResult) {
      toast.error("Please calculate dimensions first");
      return;
    }

    const payload = {
      type: "service",
      totalAmount: calculationResult.pricing.finalQuote,
      serviceData: {
        serviceType: "rebar",
        ...calculationResult.summary,
        maxDimensionDetected:
          calculationResult.shippingStatus.maxDimensionDetected,
        shippingPrice: calculationResult.pricing.shippingPrice,
        shippingMethod: calculationResult.shippingStatus.method,
      },
      pricing: calculationResult.pricing,
      shippingStatus: calculationResult.shippingStatus,
      userId: session?.user?.id,
      guestId: !session?.user?.id ? getOrCreateGuestId() : undefined,
    };

    addToCart(payload, {
      onSuccess: () => {
        toast.success("Successfully added to cart");
      },
      // onError: (err: { message?: string }) => {
      //   toast.error(err?.message || "Failed to add to cart");
      // },
      onError: () => {
        setShowUnauthorizedModal(true);
      },
    });
  };

  const BASE_BOX =
    "w-full h-12 px-3 box-border rounded-xl border-2 flex items-center transition-all duration-300";

  return (<>
    {showUnauthorizedModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            Unauthorized
          </h2>

          <p className="text-gray-600 mb-6">
            You are not authorized to add products to the cart.
            Please login with an authorized account.
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowUnauthorizedModal(false)}
              className="px-4 py-2 border rounded-lg"
            >
              Close
            </button>

            <Link
              href="/login"
              className="px-4 py-2 bg-[#7E1800] text-white rounded-lg"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    )}

    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#7E1800]/10 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-[#7E1800]" />
            <span className="text-sm font-semibold text-[#7E1800]">
              Suministro de Ferralla Premium
            </span>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
            Ferralla a Medida
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Elaboramos la ferralla a medida conforme a tus necesidades técnicas.
            Selecciona el tipo de ferralla y configura sus dimensiones.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: SVG Visualization */}
          <div className="lg:col-span-6">
            <div className="sticky top-28 ">
              <div className="relative group">
                <div className="relative h-full rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xl flex flex-col min-h-[500px]">
                  <div className="absolute top-4 right-4 z-10">
                    <div className="px-4 py-2 rounded-lg bg-[#7E1800] text-white text-sm font-semibold shadow-lg uppercase">
                      {material || "Acero Corrugado"}
                    </div>
                  </div>
                  <div className="relative w-full flex-1 flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 min-h-[520px]">
                    {/* Grid Background */}
                    <svg
                      className="absolute inset-0 w-full h-full"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <pattern
                          id="grid"
                          width="20"
                          height="20"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d="M 20 0 L 0 0 0 20"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="0.5"
                          />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>

                    {/* Shape Rendering */}
                    <div className="relative z-10 w-4/5 h-4/5 flex items-center justify-center transition-all duration-500 ease-out transform hover:scale-105">
                      {selectedTemplate?.imageUrl ? (
                        <Image
                          src={selectedTemplate.imageUrl}
                          alt={selectedTemplate.shapeName}
                          width={400}
                          height={400}
                          className="max-w-full max-h-full object-contain drop-shadow-2xl"
                          priority
                        />
                      ) : (
                        <div className="text-slate-400 font-medium text-center">
                          <div className="text-6xl mb-4">⚒️</div>
                          Selecciona una forma para visualizar
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Configuration Panel */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 h-full flex flex-col">
              <div className="space-y-6 flex-1">
                {/* 1. Shape Selection */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#7E1800]" />
                    Selecciona plantilla
                  </h3>
                  {isLoading ? (
                    <div className="text-center py-4 text-slate-500">
                      Cargando plantillas...
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {templates.map((shape) => (
                        <button
                          key={shape._id}
                          onClick={() => handleShapeSelect(shape._id)}
                          className={`group relative h-24 rounded-xl cursor-pointer border-2 transition-all duration-300 flex flex-col items-center justify-center p-2 ${selectedShapeId === shape._id
                            ? "border-[#7E1800] bg-white shadow-lg scale-[1.02]"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                            }`}
                          title={shape.shapeName}
                        >
                          <Image
                            src={shape.imageUrl}
                            alt={shape.shapeName}
                            width={40}
                            height={40}
                            className="w-10 h-10 object-contain mb-1 opacity-80 group-hover:opacity-100 transition-opacity"
                          />
                          <span className="text-[10px] font-bold text-slate-600 text-center leading-tight line-clamp-2 uppercase">
                            {shape.shapeName}
                          </span>
                          {selectedShapeId === shape._id && (
                            <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow">
                              <span className="text-white text-[10px] font-bold">
                                ✓
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedTemplate && (
                  <>
                    {/* 3. Thickness Selection (Diameter for Rebar) */}
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-[#7E1800]"></div>
                        DIÁMETRO (MM)
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {selectedTemplate.availableDiameters.map((t) => (
                          <button
                            key={t}
                            onClick={() => {
                              setThickness(String(t));
                              handleCalculate(quantity, dimensions, String(t));
                            }}
                            className={`py-3 px-2 rounded-lg border-2 cursor-pointer font-semibold transition-all duration-300 ${thickness === String(t)
                              ? "border-[#7E1800] bg-[#7E1800] text-white shadow-lg scale-105"
                              : "border-slate-200 bg-white text-slate-700 hover:border-[#7E1800]/30 hover:shadow-md"
                              }`}
                          >
                            {t}mm
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 4. Dimensions Grid */}
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-[#7E1800]"></div>
                        MEDIDAS (MM)
                      </label>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedTemplate.dimensions.map((dim, index) => (
                          <div key={`${dim.key}-${index}`} className="space-y-2">
                            <div className="flex justify-between items-end">
                              <label
                                htmlFor={`dim-${dim.key}-${index}`}
                                className="block text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1"
                              >
                                {dim.label || `Medida ${dim.key}`}
                              </label>
                              <span className="text-[12px] text-slate-400 font-mono">
                                {dim.minRange}mm-{dim.maxRange}mm
                              </span>
                            </div>

                            <div className="relative group">
                              {dim.isCalculated ? (
                                <div
                                  className={`${BASE_BOX} border-slate-100 bg-slate-50 text-slate-500 font-mono text-sm`}
                                >
                                  Calculado
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-center border border-[#7E1800]/20 rounded-lg bg-white overflow-hidden focus-within:border-[#7E1800] transition-colors">
                                    <input
                                      type="number"
                                      id={`dim-${dim.key}-${index}`}
                                      min={dim.minRange}
                                      max={dim.maxRange}
                                      value={dimensions[dim.key] || ""}
                                      onChange={(e) =>
                                        handleDimensionChange(
                                          dim.key,
                                          e.target.value,
                                        )
                                      }
                                      className="flex-1 px-3 py-2 text-center text-sm font-medium focus:outline-none"
                                      placeholder={`${dim.minRange}`}
                                    />
                                    <span className="px-3 text-xs text-slate-600 font-medium h-full flex items-center border-l border-[#7E1800]/20">
                                      {dim.unit || "mm"}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                            {errors[dim.key] && (
                              <p className="text-[10px] text-red-500 font-medium italic">
                                {errors[dim.key]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quantity & Price Section */}
                    <div className="border-t-2 border-[#7E1800]/20 pt-6">
                      {calculationResult && (
                        <>
                          {calculationResult.shippingStatus && (
                            <div className="p-5 rounded-xl border-2 border-[#7E1800]/20 bg-gradient-to-br from-[#7E1800]/5 to-white mb-6">
                              <div className="flex items-center gap-2 mb-3">
                                <h3 className="text-base font-semibold text-gray-900">
                                  Método de envío
                                </h3>
                                <span className="text-xs text-gray-500">
                                  (Calculado automáticamente)
                                </span>
                              </div>
                              <div
                                className={`relative p-4 rounded-lg border-2 flex items-center justify-between transition-all ${calculationResult.shippingStatus.method ===
                                  "courier"
                                  ? "bg-green-50 border-green-300"
                                  : "bg-blue-50 border-blue-300"
                                  }`}
                              >
                                <div>
                                  <div
                                    className={`font-bold text-base ${calculationResult.shippingStatus
                                      .method === "courier"
                                      ? "text-green-800"
                                      : "text-blue-800"
                                      }`}
                                  >
                                    {calculationResult.shippingStatus
                                      .method === "courier"
                                      ? "🚚 Servicio de mensajería"
                                      : "🚛 Envío en camión"}
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {calculationResult.shippingStatus
                                      .method === "courier"
                                      ? "Paquete estándar (≤ 2,5 m)"
                                      : "Carga grande (> 2,5 m)"}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div
                                    className={`text-2xl font-bold ${calculationResult.shippingStatus
                                      .method === "courier"
                                      ? "text-green-700"
                                      : "text-blue-700"
                                      }`}
                                  >
                                    €
                                    {calculationResult.pricing.shippingPrice.toFixed(
                                      2,
                                    )}
                                  </div>
                                  <div className="text-lg font-bold text-gray-500">
                                    Peso total:{" "}
                                    {calculationResult.summary.totalWeight?.toFixed(
                                      1,
                                    )}{" "}
                                    kg
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
                            {/* Quantity */}
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-slate-700 mb-2">
                                Cantidad
                              </span>
                              <div className="flex items-center border-2 border-[#7E1800]/20 rounded-lg overflow-hidden bg-white">
                                <button
                                  onClick={() => {
                                    const newQty = Math.max(1, quantity - 1);
                                    setQuantity(newQty);
                                    handleCalculate(newQty);
                                  }}
                                  className="px-4 py-3 hover:bg-[#7E1800]/5 transition-colors border-r-2 border-[#7E1800]/20"
                                >
                                  <div className="w-5 h-5 flex items-center justify-center font-bold text-slate-700">
                                    −
                                  </div>
                                </button>
                                <input
                                  type="number"
                                  value={quantity}
                                  onChange={(e) => {
                                    const newQty = Math.max(
                                      1,
                                      parseInt(e.target.value) || 1,
                                    );
                                    setQuantity(newQty);
                                    handleCalculate(newQty);
                                  }}
                                  className="w-16 py-3 text-lg font-bold text-center outline-none"
                                />
                                <button
                                  onClick={() => {
                                    const newQty = quantity + 1;
                                    setQuantity(newQty);
                                    handleCalculate(newQty);
                                  }}
                                  className="px-4 py-3 hover:bg-[#7E1800]/5 transition-colors border-l-2 border-[#7E1800]/20"
                                >
                                  <div className="w-5 h-5 flex items-center justify-center font-bold text-slate-700">
                                    +
                                  </div>
                                </button>
                              </div>
                            </div>

                            {/* Total Breakdown */}
                            <div className="w-full flex-1 flex flex-col gap-4">
                              <div className="bg-gradient-to-br from-[#7E1800]/5 to-white p-4 rounded-xl border-2 border-[#7E1800]/10">
                                <div className="flex justify-between text-sm mb-2 border-b border-[#7E1800]/10 pb-2">
                                  <span className="text-lg font-bold text-gray-600">
                                    Precio por Unidad:
                                  </span>
                                  <span className="text-lg font-bold text-gray-900">
                                    €
                                    {calculationResult.pricing.pricePerUnit.toFixed(
                                      2,
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                  <span className="text-lg font-bold text-gray-900">
                                    Importe Total:
                                  </span>
                                  <span className="text-2xl font-bold text-[#7E1800]">
                                    €
                                    {calculationResult.pricing.finalQuote.toFixed(
                                      2,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={handleAddToCart}
                          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold text-lg transition-all bg-linear-to-r from-[#7E1800] to-[#7E1800]/80 text-white hover:from-[#7E1800]/80 hover:to-[#7E1800] shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                        >
                          <ShoppingCart className="w-6 h-6 group-hover:scale-110 transition-transform" />
                          Añadir al carrito
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </>
  );
};

export default Rebar;
