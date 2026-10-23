using System.Net;
using Microsoft.Extensions.Options;
using SmartWMS.Application.Common.Exceptions;
using SmartWMS.Application.Common.Models.Configurations;
using SmartWMS.Infrastructure.Services;

static class AiChecks
{
    public static async Task Run(Action<bool,string> check)
    {
        // Controlled dependency-boundary cases, NEVER evidence of live provider success.
        foreach(var payload in new[]{"{}","null","not json","{\"candidates\":[]}","{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"\"}]}}]}"})
        {
            using var client=new HttpClient(new Stub(payload));
            var service=new GeminiInsightService(client,Options.Create(new GeminiSettings{ApiKey="fixture-only",DefaultModel="fixture-text",ProModel="fixture-text",EmbeddingModel="fixture-embedding"}));
            bool rejected=false;try{await service.GenerateInsightAsync("fixture",default);}catch(AiDependencyException ex){rejected=ex.Code=="AI_RESPONSE_INVALID";}
            check(rejected,"controlled invalid Gemini text envelope => AI_RESPONSE_INVALID");
        }
        foreach(var payload in new[]{"{}","null","not json","{\"embedding\":{\"values\":[1,2]}}","{\"embedding\":{\"values\":[]}}"})
        {
            using var client=new HttpClient(new Stub(payload));
            var service=new GeminiEmbeddingService(client,Options.Create(new GeminiSettings{ApiKey="fixture-only",DefaultModel="fixture-text",ProModel="fixture-text",EmbeddingModel="fixture-embedding"}));
            bool rejected=false;try{await service.GenerateEmbeddingAsync("fixture",default);}catch(AiDependencyException ex){rejected=ex.Code=="AI_RESPONSE_INVALID";}
            check(rejected,"controlled invalid embedding envelope/dimensions => AI_RESPONSE_INVALID");
        }
        foreach(var status in new[]{HttpStatusCode.TooManyRequests,HttpStatusCode.InternalServerError,HttpStatusCode.NotFound})
        {
            using var client=new HttpClient(new Stub("{}",status));var service=new GeminiInsightService(client,Options.Create(new GeminiSettings{ApiKey="fixture-only",DefaultModel="fixture-text",ProModel="fixture-text",EmbeddingModel="fixture-embedding"}));
            bool rejected=false;try{await service.GenerateInsightAsync("fixture",default);}catch(HttpRequestException){rejected=true;}
            check(rejected,"controlled provider HTTP "+(int)status+" propagates dependency failure");
        }
        using(var client=new HttpClient(new Stub("{}")))
        {
            var service=new GeminiInsightService(client,Options.Create(new GeminiSettings{ApiKey=""}));
            bool rejected=false;try{await service.GenerateInsightAsync("fixture",default);}catch(AiDependencyException ex){rejected=ex.Code=="AI_CONFIGURATION_MISSING";}
            check(rejected,"missing key fails before provider I/O");
        }
        using(var client=new HttpClient(new Stub("{}",delay:true)))
        {
            var service=new GeminiInsightService(client,Options.Create(new GeminiSettings{ApiKey="fixture-only",DefaultModel="fixture-text",ProModel="fixture-text",EmbeddingModel="fixture-embedding"}));using var cts=new CancellationTokenSource(20);
            bool canceled=false;try{await service.GenerateInsightAsync("fixture",cts.Token);}catch(OperationCanceledException){canceled=true;}
            check(canceled,"request cancellation reaches provider HTTP transport");
        }
    }
    sealed class Stub(string text,HttpStatusCode status=HttpStatusCode.OK,bool delay=false):HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        {
            if(request.RequestUri!.Query.Contains("key="))throw new Exception("Key must not appear in URI");
            if(!request.Headers.Contains("x-goog-api-key"))throw new Exception("Key header missing");
            if(delay)await Task.Delay(10000,ct);
            return new(status){Content=new StringContent(text)};
        }
    }
}
